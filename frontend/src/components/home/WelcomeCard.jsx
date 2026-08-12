import { motion } from "framer-motion";

const WelcomeCard = () => {
  const hour = new Date().getHours();

  let greeting = "शुभ संध्या!";
  let message = "कल की ज़रूरत का सामान अभी कार्ट में डालें।";

  if (hour < 12) {
    greeting = "शुभ प्रभात!";
    message = "घर बैठे आसानी से अपना ऑर्डर करें।";
  } else if (hour < 17) {
    greeting = "शुभ दोपहर!";
    message = "आज का ताज़ा सामान आपके इंतज़ार में है।";
  }

  return (
    <motion.section
      initial={{
        opacity: 0,
        y: 24,
        scale: 0.97,
      }}
      animate={{
        opacity: 1,
        y: 0,
        scale: 1,
      }}
      transition={{
        duration: 0.6,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="
        relative
        mx-3
        mt-3
        mb-1
        h-[154px]
        overflow-hidden
        rounded-[28px]
        bg-gradient-to-br
        from-[#f40612]
        via-[#ff2635]
        to-[#ff7918]
        shadow-[0_14px_35px_rgba(239,68,68,0.20)]
      "
    >
      {/* =====================================================
          BACKGROUND
      ====================================================== */}

      {/* Large soft glow */}
      <div
        className="
          pointer-events-none
          absolute
          -right-16
          -top-20
          h-52
          w-52
          rounded-full
          bg-orange-300/30
          blur-3xl
        "
      />

      <div
        className="
          pointer-events-none
          absolute
          -bottom-24
          -left-16
          h-48
          w-48
          rounded-full
          bg-red-950/20
          blur-3xl
        "
      />

      {/* Decorative circles */}
      <motion.div
        animate={{
          rotate: 360,
        }}
        transition={{
          duration: 22,
          repeat: Infinity,
          ease: "linear",
        }}
        className="
          pointer-events-none
          absolute
          -right-8
          top-3
          h-28
          w-28
          rounded-full
          border
          border-white/10
        "
      />

      <div
        className="
          pointer-events-none
          absolute
          right-8
          top-10
          h-2
          w-2
          rounded-full
          bg-white/50
        "
      />

      <div
        className="
          pointer-events-none
          absolute
          right-16
          bottom-10
          h-1.5
          w-1.5
          rounded-full
          bg-white/40
        "
      />

      {/* =====================================================
          ANIMATED LIGHT SWEEP
      ====================================================== */}

      <motion.div
        initial={{
          x: "-120%",
        }}
        animate={{
          x: "160%",
        }}
        transition={{
          duration: 5,
          repeat: Infinity,
          repeatDelay: 4,
          ease: "easeInOut",
        }}
        className="
          pointer-events-none
          absolute
          inset-y-0
          w-20
          -skew-x-12
          bg-gradient-to-r
          from-transparent
          via-white/10
          to-transparent
          blur-sm
        "
      />

      {/* =====================================================
          MAIN CONTENT
      ====================================================== */}

      <div className="relative z-10 flex h-full items-center">
        {/* ===================================================
            LEFT
        ==================================================== */}

        <motion.div
          initial={{
            opacity: 0,
            x: -18,
          }}
          animate={{
            opacity: 1,
            x: 0,
          }}
          transition={{
            delay: 0.12,
            duration: 0.55,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="
            relative
            z-20
            flex
            h-full
            w-[62%]
            flex-col
            justify-center
            pl-5
            pr-1
          "
        >
          {/* Greeting chip */}

          <div
            className="
              mb-3
              flex
              w-fit
              items-center
              gap-1.5
              rounded-full
              border
              border-white/20
              bg-white/15
              px-2.5
              py-1
              shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]
              backdrop-blur-md
            "
          >
            <img
              src="./namaste.png"
              alt="Namaste"
              className="h-4 w-4 object-contain"
            />

            <span className="text-[10px] font-semibold tracking-wide text-white">
              नमस्ते!
            </span>
          </div>

          {/* Greeting */}

          <h1
            className="
              text-[26px]
              font-black
              leading-[1.05]
              tracking-[-0.03em]
              text-white
            "
          >
            {greeting}
          </h1>

          {/* Message */}

          <p
            className="
              mt-1.5
              max-w-[190px]
              text-[10.5px]
              font-medium
              leading-[1.5]
              text-white/75
            "
          >
            {message}
          </p>

          {/* Bottom mini status */}
        </motion.div>

        {/* ===================================================
            RIGHT CHARACTER AREA
        ==================================================== */}

        <div
          className="
            absolute
            right-[-3px]
            top-0
            h-full
            w-[47%]
          "
        >
          {/* Glass character backdrop */}

          <motion.div
            animate={{
              scale: [1, 1.04, 1],
              rotate: [0, 2, 0],
            }}
            transition={{
              duration: 5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="
              absolute
              right-6
              top-5
              h-[112px]
              w-[112px]
              rounded-[32px]
              border
              border-white/25
              bg-white/15
              shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]
              backdrop-blur-[2px]
            "
          />

          {/* Inner glow */}

          <div
            className="
              absolute
              right-8
              top-8
              h-20
              w-20
              rounded-full
              bg-orange-200/30
              blur-2xl
            "
          />

          {/* Character */}

          <motion.img
            src="./holdingGrocery.png"
            alt="Shopping Character"
            draggable={false}
            className="
              pointer-events-none
              absolute
              -bottom-[12px]
              right-[-12px]
              z-10
              h-[166px]
              w-[166px]
              object-contain
              drop-shadow-[0_14px_12px_rgba(120,20,0,0.22)]
            "
            initial={{
              opacity: 0,
              y: 25,
              scale: 0.82,
              rotate: -6,
            }}
            animate={{
              opacity: 1,
              y: [0, -5, 0],
              scale: [1, 1.015, 1],
              rotate: [0, 1, -1, 0],
            }}
            transition={{
              opacity: {
                duration: 0.55,
              },
              y: {
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut",
              },
              scale: {
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut",
              },
              rotate: {
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut",
              },
            }}
          />

          {/* Tiny floating sparkle */}

          <motion.div
            animate={{
              y: [0, -5, 0],
              opacity: [0.4, 1, 0.4],
            }}
            transition={{
              duration: 2.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="
              absolute
              right-5
              top-7
              z-20
              h-2
              w-2
              rounded-full
              bg-white
              shadow-[0_0_12px_rgba(255,255,255,0.9)]
            "
          />

          <motion.div
            animate={{
              y: [0, 4, 0],
              opacity: [0.3, 0.8, 0.3],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 0.7,
            }}
            className="
              absolute
              right-24
              top-20
              z-20
              h-1.5
              w-1.5
              rounded-full
              bg-yellow-200
            "
          />
        </div>
      </div>

      {/* =====================================================
          TOP GLASS EDGE
      ====================================================== */}

      <div
        className="
          pointer-events-none
          absolute
          inset-x-0
          top-0
          h-px
          bg-white/30
        "
      />

      {/* =====================================================
          BOTTOM SHINE
      ====================================================== */}

      <div
        className="
          pointer-events-none
          absolute
          inset-x-6
          bottom-0
          h-px
          bg-white/15
        "
      />
    </motion.section>
  );
};

export default WelcomeCard;
