import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Search, X, Mic, MicOff } from "lucide-react";

const SearchBar = ({ value, onChange }) => {
  const recognitionRef = useRef(null);

  const [isListening, setIsListening] = useState(false);

  const [isSupported, setIsSupported] = useState(true);

  // =====================================================
  // SETUP SPEECH RECOGNITION
  // =====================================================

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = true;

    // Hindi gives better results for
    // Hindi + Hinglish speech in many cases.
    recognition.lang = "hi-IN";

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      let transcript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }

      transcript = transcript.trim();

      if (transcript) {
        onChange(transcript);
      }
    };

    recognition.onerror = (event) => {
      console.log("Speech recognition error:", event.error);

      setIsListening(false);

      if (event.error === "not-allowed") {
        // Don't show this repeatedly if
        // browser permission was denied.
        return;
      }

      if (event.error === "no-speech") {
        return;
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
      recognitionRef.current = null;
    };
  }, [onChange]);

  // =====================================================
  // TOGGLE VOICE SEARCH
  // =====================================================

  const toggleVoiceSearch = () => {
    if (!isSupported) {
      alert("आपका browser voice search support नहीं करता।");
      return;
    }

    if (!recognitionRef.current) {
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    try {
      recognitionRef.current.start();
    } catch (error) {
      console.log("Voice search could not start:", error);
    }
  };

  return (
    <motion.header
      initial={{
        opacity: 0,
        y: 18,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      transition={{
        duration: 0.45,
      }}
      className="sticky top-0 z-20 bg-gray-50 px-4 py-4"
    >
      <div className="relative">
        {/* =================================================
            SEARCH ICON
        ================================================= */}

        <Search
          size={20}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
        />

        {/* =================================================
            SEARCH INPUT
        ================================================= */}

        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={isListening ? "बोलिए..." : "सामान खोजें..."}
          className="
            h-12
            w-full
            rounded-2xl
            border
            border-gray-200
            bg-white
            pl-12
            pr-24
            text-[15px]
            font-medium
            text-gray-700
            shadow-sm
            outline-none
            transition-all
            duration-200
            placeholder:text-gray-400
            focus:border-red-500
            focus:ring-4
            focus:ring-red-100
          "
        />

        {/* =================================================
            RIGHT ACTIONS
        ================================================= */}

        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {/* CLEAR */}

          {value && !isListening && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="
                rounded-full
                p-2
                text-gray-400
                transition
                hover:bg-gray-100
                hover:text-gray-700
              "
              aria-label="Clear search"
            >
              <X size={17} />
            </button>
          )}

          {/* =================================================
              MICROPHONE
          ================================================= */}

          {isSupported && (
            <button
              type="button"
              onClick={toggleVoiceSearch}
              className={`
                relative
                rounded-xl
                p-2
                transition-all
                duration-200
                ${
                  isListening
                    ? "bg-red-500 text-white shadow-md"
                    : "text-gray-500 hover:bg-gray-100 hover:text-red-500"
                }
              `}
              aria-label={isListening ? "Stop voice search" : "Voice search"}
            >
              {/* Listening pulse */}

              {isListening && (
                <span
                  className="
                    absolute
                    inset-0
                    rounded-xl
                    bg-red-400
                    animate-ping
                    opacity-30
                  "
                />
              )}

              <span className="relative z-10 block">
                {isListening ? <MicOff size={18} /> : <Mic size={18} />}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* =================================================
          LISTENING INDICATOR
      ================================================= */}

      {isListening && (
        <motion.div
          initial={{
            opacity: 0,
            height: 0,
          }}
          animate={{
            opacity: 1,
            height: "auto",
          }}
          className="mt-2 flex items-center justify-center gap-2 text-xs font-medium text-red-500"
        >
          <span className="flex gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-bounce" />
            <span
              className="h-1.5 w-1.5 rounded-full bg-red-500 animate-bounce"
              style={{
                animationDelay: "0.15s",
              }}
            />
            <span
              className="h-1.5 w-1.5 rounded-full bg-red-500 animate-bounce"
              style={{
                animationDelay: "0.3s",
              }}
            />
          </span>
          बोलिए, सामान खोजें...
        </motion.div>
      )}
    </motion.header>
  );
};

export default SearchBar;
