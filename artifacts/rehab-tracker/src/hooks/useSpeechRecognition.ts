import { useCallback, useEffect, useRef, useState } from "react";

type SpeechRecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((ev: any) => void) | null;
  onerror: ((ev: any) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return (w.SpeechRecognition || w.webkitSpeechRecognition || null) as SpeechRecognitionCtor | null;
}

export interface UseSpeechRecognitionOptions {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
  onFinalTranscript?: (text: string) => void;
  onInterimTranscript?: (text: string) => void;
}

export function useSpeechRecognition(options: UseSpeechRecognitionOptions = {}) {
  const {
    lang = "he-IL",
    continuous = true,
    interimResults = true,
    onFinalTranscript,
    onInterimTranscript,
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const isSupported = !!getSpeechRecognition();

  const finalCb = useRef(onFinalTranscript);
  const interimCb = useRef(onInterimTranscript);
  useEffect(() => { finalCb.current = onFinalTranscript; }, [onFinalTranscript]);
  useEffect(() => { interimCb.current = onInterimTranscript; }, [onInterimTranscript]);

  const stop = useCallback(() => {
    const rec = recognitionRef.current;
    if (rec) {
      try { rec.stop(); } catch {}
    }
    setIsListening(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = getSpeechRecognition();
    if (!Ctor) {
      setError("Speech recognition is not supported in this browser. Try Chrome or Edge.");
      return;
    }
    setError(null);

    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
    }

    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = continuous;
    rec.interimResults = interimResults;

    rec.onresult = (event: any) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        const transcript = res[0].transcript;
        if (res.isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }
      if (final && finalCb.current) finalCb.current(final);
      if (interim && interimCb.current) interimCb.current(interim);
    };

    rec.onerror = (event: any) => {
      const err = event?.error || "unknown";
      if (err === "no-speech") return;
      if (err === "not-allowed" || err === "service-not-allowed") {
        setError("Microphone access was denied. Please allow it in your browser settings.");
      } else if (err === "audio-capture") {
        setError("No microphone was found.");
      } else {
        setError(`Speech recognition error: ${err}`);
      }
      setIsListening(false);
    };

    rec.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = rec;
    try {
      rec.start();
      setIsListening(true);
    } catch (e: any) {
      setError(e?.message || "Failed to start speech recognition.");
      setIsListening(false);
    }
  }, [lang, continuous, interimResults]);

  useEffect(() => {
    return () => {
      const rec = recognitionRef.current;
      if (rec) {
        try { rec.abort(); } catch {}
      }
    };
  }, []);

  return { isListening, error, isSupported, start, stop };
}
