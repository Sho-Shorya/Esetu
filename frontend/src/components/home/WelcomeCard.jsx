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
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
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
        from-[#ef101c]
        via-[#ff2635]
        to-[#ff7418]
        shadow-[0_12px_32px_rgba(239,68,68,0.18)]
        isolate
      "
    >
      {/* =====================================================
          STATIC DEPTH
      ====================================================== */}

      <div
        className="
          pointer-events-none
          absolute
          -right-12
          -top-16
          h-44
          w-44
          rounded-full
          bg-orange-300/20
          blur-2xl
        "
      />

      <div
        className="
          pointer-events-none
          absolute
          -bottom-20
          -left-14
          h-40
          w-40
          rounded-full
          bg-red-950/20
          blur-2xl
        "
      />

      {/* =====================================================
          PREMIUM ORBIT
      ====================================================== */}

      <div
        className="
          pointer-events-none
          absolute
          -right-8
          -top-8
          h-[138px]
          w-[138px]
          rounded-full
          border
          border-white/15
        "
      />

      <div
        className="
          pointer-events-none
          absolute
          -right-1
          top-[18px]
          h-[92px]
          w-[92px]
          rounded-full
          border
          border-white/10
        "
      />

      {/* =====================================================
          STATIC PARTICLES
          No infinite animation = very cheap
      ====================================================== */}

      <span
        className="
          pointer-events-none
          absolute
          right-[84px]
          top-[22px]
          h-1.5
          w-1.5
          rounded-full
          bg-white/70
        "
      />

      <span
        className="
          pointer-events-none
          absolute
          right-[28px]
          top-[57px]
          h-2
          w-2
          rounded-full
          bg-yellow-200/80
        "
      />

      <span
        className="
          pointer-events-none
          absolute
          right-[74px]
          bottom-[22px]
          h-1
          w-1
          rounded-full
          bg-white/60
        "
      />

      <span
        className="
          pointer-events-none
          absolute
          right-[132px]
          top-[46px]
          h-1
          w-1
          rounded-full
          bg-white/50
        "
      />

      {/* =====================================================
          CONTENT
      ====================================================== */}

      <div className="relative z-10 flex h-full">
        {/* ===================================================
            LEFT CONTENT
        ==================================================== */}

        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{
            delay: 0.06,
            duration: 0.35,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="
            flex
            h-full
            w-[63%]
            flex-col
            justify-center
            pl-5
            pr-0
          "
        >
          {/* Greeting chip */}

          <div
            className="
              mb-2.5
              flex
              w-fit
              items-center
              gap-1.5
              rounded-full
              border
              border-white/20
              bg-white/10
              px-2.5
              py-1
            "
          >
            <img
              src="./namaste.png"
              alt=""
              draggable={false}
              width="16"
              height="16"
              loading="eager"
              decoding="async"
              className="h-4 w-4 object-contain"
            />

            <span
              className="
                text-[10px]
                font-bold
                tracking-wide
                text-white
              "
            >
              नमस्ते!
            </span>
          </div>

          {/* Greeting */}

          <h1
            className="
              text-[26px]
              font-black
              leading-[1]
              tracking-[-0.035em]
              text-white
            "
          >
            {greeting}
          </h1>

          {/* Message */}

          <p
            className="
              mt-2
              max-w-[185px]
              text-[10.5px]
              font-medium
              leading-[1.45]
              text-white/75
            "
          >
            {message}
          </p>
        </motion.div>

        {/* ===================================================
            CHARACTER SIDE
        ==================================================== */}

        <div
          className="
            pointer-events-none
            absolute
            right-0
            top-0
            h-full
            w-[45%]
          "
        >
          {/* Character platform */}

          <motion.div
            initial={{
              opacity: 0,
              scale: 0.92,
            }}
            animate={{
              opacity: 1,
              scale: 1,
            }}
            transition={{
              delay: 0.12,
              duration: 0.4,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="
              absolute
              right-5
              top-[17px]
              h-[116px]
              w-[116px]
              rounded-[34px]
              border
              border-white/20
              bg-white/10
            "
          />

          {/* Inner circle */}

          <div
            className="
              absolute
              right-[27px]
              top-[28px]
              h-[94px]
              w-[94px]
              rounded-full
              bg-orange-200/15
            "
          />

          {/* =================================================
              CHARACTER
          ================================================== */}

          <motion.img
            src="./holdingGrocery.png"
            alt=""
            draggable={false}
            width="166"
            height="166"
            loading="eager"
            decoding="async"
            fetchPriority="high"
            initial={{
              opacity: 0,
              y: 18,
              scale: 0.9,
            }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
            }}
            transition={{
              delay: 0.1,
              duration: 0.45,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="
              absolute
              -bottom-[12px]
              right-[-10px]
              z-10
              h-[166px]
              w-[166px]
              object-contain
              drop-shadow-[0_10px_8px_rgba(90,20,0,0.18)]
            "
          />

          {/* =================================================
              SPARKLES
          ================================================== */}

          <motion.span
            initial={{
              opacity: 0,
              scale: 0,
            }}
            animate={{
              opacity: [0, 1, 0.5],
              scale: [0, 1, 0.8],
            }}
            transition={{
              delay: 0.5,
              duration: 0.6,
            }}
            className="
              absolute
              right-[20px]
              top-[24px]
              z-20
              h-2
              w-2
              rounded-full
              bg-white
              shadow-[0_0_10px_rgba(255,255,255,0.8)]
            "
          />

          <motion.span
            initial={{
              opacity: 0,
              scale: 0,
            }}
            animate={{
              opacity: 1,
              scale: 1,
            }}
            transition={{
              delay: 0.65,
              duration: 0.25,
            }}
            className="
              absolute
              right-[102px]
              top-[67px]
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
          BOTTOM EDGE
      ====================================================== */}

      <div
        className="
          pointer-events-none
          absolute
          bottom-0
          left-6
          right-6
          h-px
          bg-white/15
        "
      />

      {/* =====================================================
          ONE-TIME LIGHT SWEEP
          Doesn't run forever
      ====================================================== */}

      <motion.div
        initial={{
          x: "-120%",
        }}
        animate={{
          x: "160%",
        }}
        transition={{
          delay: 0.7,
          duration: 1.1,
          ease: "easeInOut",
        }}
        className="
          pointer-events-none
          absolute
          inset-y-0
          z-30
          w-16
          -skew-x-12
          bg-gradient-to-r
          from-transparent
          via-white/10
          to-transparent
        "
      />
    </motion.section>
  );
};

export default WelcomeCard;
