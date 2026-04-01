"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { LogoIcon } from "@/app/components/icons/LogoIcon";
import { signOut } from "@/app/lib/auth";
import { useAuthGuard } from "@/app/lib/useAuthGuard";

type ChatMessage =
  | {
      id: string;
      role: "assistant" | "user";
      kind: "text";
      text: string;
    }
  | {
      id: string;
      role: "user";
      kind: "audio";
      audioUrl: string;
      durationLabel: string;
    };

const initialMessages: ChatMessage[] = [
  {
    id: "m1",
    role: "assistant",
    kind: "text",
    text: "Hi! How are you?",
  },
  {
    id: "m2",
    role: "assistant",
    kind: "text",
    text: "To record a message, tap the microphone.",
  },
];

const DEFAULT_AUDIO_INPUT_ID = "__default__";
const AUDIO_INPUT_STORAGE_KEY = "speak-simple:selected-audio-input";
const VOICE_ACTIVITY_THRESHOLD = 0.06;

function getSupportedRecordingMimeType() {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return "";
  }

  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];

  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

export default function ChatPlaceholder() {
  const router = useRouter();
  const { session, status } = useAuthGuard({ mode: "required" });
  const [isSigningOut, setIsSigningOut] = React.useState(false);
  const [messages, setMessages] = React.useState<ChatMessage[]>(() => [...initialMessages]);
  const [audioInputs, setAudioInputs] = React.useState<Array<{ id: string; label: string }>>([]);
  const [selectedInputId, setSelectedInputId] = React.useState(DEFAULT_AUDIO_INPUT_ID);
  const [inputSourceModalOpen, setInputSourceModalOpen] = React.useState(false);
  const [isRecording, setIsRecording] = React.useState(false);
  const [recordingError, setRecordingError] = React.useState<string | null>(null);
  const [recordingStartedAt, setRecordingStartedAt] = React.useState<number | null>(null);
  const preferredInputIdRef = React.useRef(DEFAULT_AUDIO_INPUT_ID);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const analysisStreamRef = React.useRef<MediaStream | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const stopActionRef = React.useRef<"cancel" | "send">("cancel");
  const createdUrlsRef = React.useRef<string[]>([]);
  const messagesScrollRef = React.useRef<HTMLDivElement>(null);
  const audioContextRef = React.useRef<AudioContext | null>(null);
  const analyserRef = React.useRef<AnalyserNode | null>(null);
  const analyserSourceRef = React.useRef<MediaStreamAudioSourceNode | null>(null);
  const waveformFrameRef = React.useRef<number | null>(null);
  const [micLevel, setMicLevel] = React.useState(0);
  const recordingDurationLabel = useRecordingDurationLabel(recordingStartedAt, isRecording);
  const hasVoiceActivity = isRecording && micLevel > VOICE_ACTIVITY_THRESHOLD;

  const loadAudioInputs = React.useCallback(async () => {
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.enumerateDevices
    ) {
      return;
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    const inputs = devices
      .filter((device) => device.kind === "audioinput")
      .map((device, index) => ({
        id: device.deviceId,
        label: device.label || `Microphone ${index + 1}`,
      }));

    setAudioInputs(inputs);
    setSelectedInputId((current) => {
      const preferredInputId = preferredInputIdRef.current;

      if (
        current !== DEFAULT_AUDIO_INPUT_ID &&
        inputs.some((input) => input.id === current)
      ) {
        return current;
      }

      if (
        preferredInputId !== DEFAULT_AUDIO_INPUT_ID &&
        inputs.some((input) => input.id === preferredInputId)
      ) {
        return preferredInputId;
      }

      return DEFAULT_AUDIO_INPUT_ID;
    });
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storedInputId = window.localStorage.getItem(AUDIO_INPUT_STORAGE_KEY);
    if (!storedInputId) {
      return;
    }

    preferredInputIdRef.current = storedInputId;
    setSelectedInputId(storedInputId);
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    preferredInputIdRef.current = selectedInputId;
    window.localStorage.setItem(AUDIO_INPUT_STORAGE_KEY, selectedInputId);
  }, [selectedInputId]);

  React.useEffect(() => {
    void loadAudioInputs();

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      !("addEventListener" in navigator.mediaDevices)
    ) {
      return;
    }

    const handleDeviceChange = () => {
      void loadAudioInputs();
    };

    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);

    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", handleDeviceChange);
    };
  }, [loadAudioInputs]);

  React.useEffect(() => {
    return () => {
      createdUrlsRef.current.forEach((url) => {
        URL.revokeObjectURL(url);
      });

      streamRef.current?.getTracks().forEach((track) => {
        track.stop();
      });
    };
  }, []);

  React.useEffect(() => {
    if (!inputSourceModalOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setInputSourceModalOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [inputSourceModalOpen]);

  React.useLayoutEffect(() => {
    const el = messagesScrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  const stopAudioLevelTracking = React.useCallback(() => {
    if (waveformFrameRef.current !== null && typeof window !== "undefined") {
      window.cancelAnimationFrame(waveformFrameRef.current);
      waveformFrameRef.current = null;
    }

    analyserSourceRef.current?.disconnect();
    analyserSourceRef.current = null;
    analyserRef.current = null;
    analysisStreamRef.current?.getTracks().forEach((track) => {
      track.stop();
    });
    analysisStreamRef.current = null;

    const audioContext = audioContextRef.current;
    audioContextRef.current = null;
    if (audioContext) {
      void audioContext.close().catch(() => {});
    }

    setMicLevel(0);
  }, []);

  const startAudioLevelTracking = React.useCallback(
    async (stream: MediaStream) => {
      if (typeof window === "undefined") {
        return;
      }

      const AudioContextCtor =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) {
        return;
      }

      stopAudioLevelTracking();

      const audioContext = new AudioContextCtor();
      audioContextRef.current = audioContext;

      if (audioContext.state === "suspended") {
        try {
          await audioContext.resume();
        } catch {
          // Ignore resume issues and keep the recorder usable.
        }
      }

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.82;

      const analysisStream = stream.clone();
      analysisStreamRef.current = analysisStream;

      const source = audioContext.createMediaStreamSource(analysisStream);
      source.connect(analyser);

      analyserRef.current = analyser;
      analyserSourceRef.current = source;

      const timeBuffer = new Uint8Array(analyser.fftSize);
      let smoothedLevel = 0;

      const updateLevels = () => {
        const activeAnalyser = analyserRef.current;
        if (!activeAnalyser) {
          return;
        }

        activeAnalyser.getByteTimeDomainData(timeBuffer);

        let sumSquares = 0;
        for (let i = 0; i < timeBuffer.length; i += 1) {
          const sample = (timeBuffer[i] - 128) / 128;
          sumSquares += sample * sample;
        }

        const rms = Math.sqrt(sumSquares / timeBuffer.length);
        const targetLevel = Math.min(1, rms * 7.5);
        smoothedLevel = smoothedLevel * 0.74 + targetLevel * 0.26;
        setMicLevel((current) => {
          return Math.abs(current - smoothedLevel) > 0.015 ? smoothedLevel : current;
        });

        waveformFrameRef.current = window.requestAnimationFrame(updateLevels);
      };

      updateLevels();
    },
    [stopAudioLevelTracking]
  );

  const startRecording = async () => {
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setRecordingError("Audio recording is not supported in this browser.");
      return;
    }

    const existing = mediaRecorderRef.current;
    if (existing && existing.state === "recording") {
      return;
    }

    let stream: MediaStream | null = null;
    const startedAt = Date.now();

    try {
      setRecordingError(null);

      stream = await navigator.mediaDevices.getUserMedia({
        audio: selectedInputId !== DEFAULT_AUDIO_INPUT_ID
          ? {
              deviceId: { exact: selectedInputId },
            }
          : true,
      });

      if (!stream) {
        throw new Error("Microphone stream unavailable.");
      }

      const activeStream = stream;

      await loadAudioInputs();
      await startAudioLevelTracking(activeStream);

      const mimeType = getSupportedRecordingMimeType();
      const recorder = mimeType
        ? new MediaRecorder(activeStream, { mimeType })
        : new MediaRecorder(activeStream);
      chunksRef.current = [];
      stopActionRef.current = "cancel";

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        stopAudioLevelTracking();
        activeStream.getTracks().forEach((track) => {
          track.stop();
        });

        streamRef.current = null;
        mediaRecorderRef.current = null;
        setIsRecording(false);
        setRecordingStartedAt(null);

        if (stopActionRef.current === "send" && chunksRef.current.length > 0) {
          const blob = new Blob(chunksRef.current, {
            type: recorder.mimeType || mimeType || "audio/webm",
          });
          const audioUrl = URL.createObjectURL(blob);
          createdUrlsRef.current.push(audioUrl);
          const durationLabel = getDurationLabel(startedAt);

          setMessages((current) => [
            ...current,
            {
              id: crypto.randomUUID(),
              role: "user",
              kind: "audio",
              audioUrl,
              durationLabel,
            },
            {
              id: crypto.randomUUID(),
              role: "assistant",
              kind: "text",
              text: "Voice note received. Feedback can be shown here in the next step.",
            },
          ]);
        }

        chunksRef.current = [];
      };

      streamRef.current = activeStream;
      mediaRecorderRef.current = recorder;
      setRecordingStartedAt(startedAt);
      setIsRecording(true);
      recorder.start();
    } catch {
      stream?.getTracks().forEach((track) => {
        track.stop();
      });
      stopAudioLevelTracking();
      setRecordingError("Microphone access was blocked or unavailable.");
    }
  };

  const selectedInputLabel =
    selectedInputId === DEFAULT_AUDIO_INPUT_ID
      ? "Default microphone"
      : audioInputs.find((input) => input.id === selectedInputId)?.label ?? "Default microphone";

  const stopRecording = (action: "cancel" | "send") => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      return;
    }

    stopActionRef.current = action;
    recorder.stop();
  };

  React.useEffect(() => {
    return () => {
      stopAudioLevelTracking();
    };
  }, [stopAudioLevelTracking]);

  if (status === "loading") {
    return (
      <main className="min-h-screen px-6 py-10">
        <div className="mx-auto w-full max-w-2xl">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-white/65 shadow-[var(--shadow-md)] backdrop-blur">
            Restoring your session...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-dvh min-h-0 flex-col px-4 py-4 sm:px-6 sm:py-5">
      <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-3">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/10 bg-white/5 px-4 py-3 shadow-[var(--shadow-md)] backdrop-blur sm:px-5">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white/85">
              <LogoIcon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-medium text-white">SpeakSimple Chat</p>
              <p className="text-xs text-white/60">
                Signed in as {session?.user.email}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setIsSigningOut(true);
              void signOut().finally(() => {
                router.replace("/login");
                setIsSigningOut(false);
              });
            }}
            disabled={isSigningOut}
            className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSigningOut ? "Signing out..." : "Sign out"}
          </button>
        </header>

        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-[var(--shadow-lg)] backdrop-blur">
            <div
              ref={messagesScrollRef}
              className="se-scrollbar se-scrollbar-chat min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5"
            >
              {messages.map((message) => {
                const isUser = message.role === "user";
                const isAudio = message.kind === "audio";
                return (
                  <div
                    key={message.id}
                    className={`flex w-full shrink-0 ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    <article
                      className={`w-fit min-w-0 max-w-[min(78vw,20rem)] rounded-[1.25rem] border px-[0.65rem] py-2 text-[0.9375rem] leading-[1.35] break-words shadow-[var(--shadow-sm)] sm:max-w-[min(72%,24rem)] ${
                        isAudio ? "min-w-[13.5rem]" : ""
                      } ${
                        isUser
                          ? "border-cyan-300/30 bg-cyan-400/10 text-white"
                          : "border-white/10 bg-white/7 text-white/90"
                      }`}
                    >
                      {message.kind === "text" ? (
                        <p className="px-1.5 py-0.5">{message.text}</p>
                      ) : (
                        <div className="space-y-2 px-1 py-0.5">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-white/65">
                            <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-1">
                              Voice note
                            </span>
                            <span>{message.durationLabel}</span>
                          </div>
                          <audio
                            controls
                            preload="metadata"
                            className="w-full min-w-[12rem]"
                            src={message.audioUrl}
                          >
                            <track kind="captions" />
                          </audio>
                        </div>
                      )}
                    </article>
                  </div>
                );
              })}
            </div>

            <div className="shrink-0 border-t border-white/10 px-4 py-4 sm:px-5">
              <div className="rounded-3xl border border-white/10 bg-white/4 p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
                  <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-sm font-medium transition-all duration-300 ease-out ${
                          isRecording
                            ? hasVoiceActivity
                              ? "text-emerald-300"
                              : "text-white"
                            : "text-white"
                        }`}
                        style={
                          isRecording && hasVoiceActivity
                            ? {
                                textShadow: "0 0 12px rgba(110, 231, 183, 0.2)",
                              }
                            : undefined
                        }
                      >
                        {isRecording ? "Listening..." : "Voice input"}
                      </p>
                      <p className="mt-1 text-xs text-white/55">
                        {isRecording
                          ? recordingDurationLabel
                          : "Tap the microphone to record."}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 self-center">
                      <button
                        type="button"
                        onClick={() => {
                          if (isRecording) {
                            stopRecording("cancel");
                          } else {
                            void startRecording();
                          }
                        }}
                        className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border transition ${
                          isRecording
                            ? "border-white/15 bg-white/10 text-white/85 hover:border-rose-300/35 hover:bg-rose-400/15 hover:text-rose-100"
                            : "border-white/10 bg-white/5 text-white/60 hover:border-cyan-300/25 hover:bg-white/10 hover:text-cyan-100"
                        }`}
                        aria-label={isRecording ? "Cancel recording" : "Start recording"}
                      >
                        {isRecording ? (
                          <CancelIcon className="h-5 w-5" />
                        ) : (
                          <MicrophoneIcon className="h-5 w-5" />
                        )}
                      </button>
                      {isRecording ? (
                        <button
                          type="button"
                          onClick={() => {
                            stopRecording("send");
                          }}
                          className="grid h-11 w-11 place-items-center rounded-2xl border border-cyan-300/30 bg-cyan-400/15 text-cyan-100 transition hover:bg-cyan-400/25"
                          aria-label="Send recording"
                        >
                          <SendIcon className="h-5 w-5" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setInputSourceModalOpen(true);
                  }}
                  className="mt-3 flex w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-left text-sm text-white/65 transition hover:border-white/15 hover:bg-white/8"
                >
                  <span className="min-w-0 truncate text-white/60">{selectedInputLabel}</span>
                  <ChevronDownIcon className="h-4 w-4 shrink-0 text-white/50" />
                </button>

                {recordingError && (
                  <p className="mt-3 text-xs text-rose-200/85">{recordingError}</p>
                )}
              </div>

              {inputSourceModalOpen && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center p-4"
                  role="presentation"
                >
                  <button
                    type="button"
                    aria-label="Close"
                    className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
                    onClick={() => {
                      setInputSourceModalOpen(false);
                    }}
                  />
                  <div
                    className="relative z-10 w-full max-w-md rounded-3xl border border-white/10 bg-white/10 p-4 shadow-[var(--shadow-lg)] backdrop-blur-xl sm:p-5"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="input-source-dialog-title"
                  >
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <h2
                        id="input-source-dialog-title"
                        className="text-sm font-medium text-white"
                      >
                        Microphone
                      </h2>
                      <button
                        type="button"
                        onClick={() => {
                          setInputSourceModalOpen(false);
                        }}
                        className="grid h-9 w-9 place-items-center rounded-2xl border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10"
                        aria-label="Close"
                      >
                        <CancelIcon className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="se-scrollbar max-h-[min(60vh,20rem)] space-y-1 overflow-y-auto pr-1">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedInputId(DEFAULT_AUDIO_INPUT_ID);
                          setInputSourceModalOpen(false);
                        }}
                        className={`flex w-full items-center rounded-2xl border px-3 py-2.5 text-left text-sm transition ${
                          selectedInputId === DEFAULT_AUDIO_INPUT_ID
                            ? "border-cyan-300/35 bg-cyan-400/15 text-cyan-50"
                            : "border-transparent bg-white/5 text-white/85 hover:border-white/10 hover:bg-white/8"
                        }`}
                      >
                        Default microphone
                      </button>
                      {audioInputs.map((input) => (
                        <button
                          key={input.id}
                          type="button"
                          onClick={() => {
                            setSelectedInputId(input.id);
                            setInputSourceModalOpen(false);
                          }}
                          className={`flex w-full items-center rounded-2xl border px-3 py-2.5 text-left text-sm transition ${
                            selectedInputId === input.id
                              ? "border-cyan-300/35 bg-cyan-400/15 text-cyan-50"
                              : "border-transparent bg-white/5 text-white/85 hover:border-white/10 hover:bg-white/8"
                          }`}
                        >
                          <span className="min-w-0 truncate">{input.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function ChevronDownIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MicrophoneIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M12 15.25a3.75 3.75 0 0 0 3.75-3.75V7a3.75 3.75 0 1 0-7.5 0v4.5A3.75 3.75 0 0 0 12 15.25Z"
        fill="currentColor"
      />
      <path
        d="M6.5 11.75a.75.75 0 0 1 1.5 0 4 4 0 1 0 8 0 .75.75 0 0 1 1.5 0 5.5 5.5 0 0 1-4.75 5.44V20h2.25a.75.75 0 0 1 0 1.5H9a.75.75 0 0 1 0-1.5h2.25v-2.81A5.5 5.5 0 0 1 6.5 11.75Z"
        fill="currentColor"
        opacity="0.9"
      />
    </svg>
  );
}

function CancelIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M7 7L17 17M17 7L7 17"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SendIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M4 12L19 4L15 20L11.5 13.5L4 12Z"
        fill="currentColor"
      />
    </svg>
  );
}

function useRecordingDurationLabel(
  startedAt: number | null,
  isRecording: boolean
) {
  const [now, setNow] = React.useState(Date.now());

  React.useEffect(() => {
    if (!isRecording || !startedAt) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 500);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isRecording, startedAt]);

  if (!isRecording || !startedAt) {
    return "00:00";
  }

  return getDurationLabel(startedAt, now);
}

function getDurationLabel(startedAt: number | null, endAt = Date.now()) {
  if (!startedAt) {
    return "00:00";
  }

  const seconds = Math.max(0, Math.round((endAt - startedAt) / 1000));
  const minutesPart = String(Math.floor(seconds / 60)).padStart(2, "0");
  const secondsPart = String(seconds % 60).padStart(2, "0");

  return `${minutesPart}:${secondsPart}`;
}
