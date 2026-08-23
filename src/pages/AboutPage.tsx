import {
  ShieldCheck,
  Heart,
  Target,
  Users2,
  Code2,
  Sparkles,
  Network,
  ArrowUpRight,
} from "lucide-react";

const teamMembers = [
  {
    name: "Umabharathi A",
    role: "Founder & CEO",
    image: "ub.jpg",
    icon: ShieldCheck,
    description:
      "Driving the vision behind QuadraConverter and shaping a simpler, smarter future for document workflows.",
  },
  {
    name: "Dhanalakshmi E",
    role: "Co-Founder & CTO",
    image: "dhana.jpg",
    icon: Code2,
    description:
      "Building the technology that powers reliable, secure and intelligent document experiences.",
  },
  {
    name: "Meeradharshni K",
    role: "Co-Founder & COO",
    image: "meera.jpg",
    icon: Network,
    description:
      "Turning ideas into smooth operations while keeping every part of the product experience connected.",
  },
  {
    name: "Nithiya Sri M",
    role: "Co-Founder & CFO",
    image: "nithi.jpg",
    icon: Target,
    description:
      "Helping build a sustainable foundation for QuadraConverter with thoughtful planning and long-term growth.",
  },
];

export function AboutPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* =========================================================
          HERO / INTRODUCTION
      ========================================================= */}
      <section className="container-page py-16 md:py-20">
        <div className="max-w-4xl">
          <span className="section-eyebrow">ABOUT QUADRACONVERTER</span>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight mt-5 text-ink-950 leading-[1.08]">
            A simpler document future.
          </h1>

          <p className="mt-7 text-lg md:text-xl text-ink-500 leading-8 max-w-3xl">
            QuadraConverter is designed around one simple idea: document work
            should feel fast, understandable and safe. We bring conversion,
            signatures and productivity workflows into a single focused
            platform.
          </p>
        </div>

        {/* =========================================================
            VALUES
        ========================================================= */}
        <div className="grid md:grid-cols-3 gap-5 mt-14">
          {/* Mission */}
          <div className="card group p-7 md:p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
            <div className="w-12 h-12 rounded-2xl bg-brand-50 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
              <Target className="w-6 h-6 text-brand-700" />
            </div>

            <h2 className="font-bold text-xl mt-6 text-ink-950">
              Mission
            </h2>

            <p className="text-ink-500 mt-3 leading-7">
              Make powerful document tools accessible to everyone without
              unnecessary complexity.
            </p>
          </div>

          {/* Privacy */}
          <div className="card group p-7 md:p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
            <div className="w-12 h-12 rounded-2xl bg-brand-50 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
              <ShieldCheck className="w-6 h-6 text-brand-700" />
            </div>

            <h2 className="font-bold text-xl mt-6 text-ink-950">
              Privacy
            </h2>

            <p className="text-ink-500 mt-3 leading-7">
              Treat sensitive files as sensitive by default and create
              workflows people can trust.
            </p>
          </div>

          {/* People */}
          <div className="card group p-7 md:p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
            <div className="w-12 h-12 rounded-2xl bg-brand-50 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
              <Users2 className="w-6 h-6 text-brand-700" />
            </div>

            <h2 className="font-bold text-xl mt-6 text-ink-950">
              People
            </h2>

            <p className="text-ink-500 mt-3 leading-7">
              Design intuitive experiences that work equally well for
              beginners, professionals and growing teams.
            </p>
          </div>
        </div>

        {/* =========================================================
            REAL WORLD DOCUMENTS
        ========================================================= */}
        <div className="mt-12 rounded-[2rem] bg-ink-950 text-white p-8 md:p-12 relative overflow-hidden">
          {/* Decorative circles */}
          <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-white/[0.04]" />
          <div className="absolute -bottom-32 -left-20 w-80 h-80 rounded-full bg-white/[0.03]" />

          <div className="relative z-10">
            <Heart className="w-7 h-7" />

            <h2 className="text-2xl md:text-3xl font-bold mt-5">
              Designed for real-world documents
            </h2>

            <p className="text-white/70 mt-4 max-w-3xl leading-7">
              Legal files, invoices, resumes, contracts, school work and
              business documents deserve a workflow that does not get in the
              way. QuadraConverter brings the essential tools together so you
              can spend less time managing files and more time getting things
              done.
            </p>
          </div>
        </div>
      </section>

      {/* =========================================================
          OUR DEVELOPER TEAM
      ========================================================= */}
      <section className="relative py-20 md:py-28 overflow-hidden bg-[#fafafa] border-y border-ink-100">
        {/* Background decoration */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[300px] rounded-full bg-brand-100/30 blur-3xl pointer-events-none" />

        <div className="container-page relative z-10">
          {/* Section Heading */}
          <div className="text-center max-w-3xl mx-auto">
            <span className="section-eyebrow">
              THE PEOPLE BEHIND QUADRACONVERTER
            </span>

            <div className="flex items-center justify-center gap-3 mt-5">
              <div className="hidden sm:block h-px w-10 bg-ink-200" />

              <Sparkles className="w-5 h-5 text-brand-700" />

              <div className="hidden sm:block h-px w-10 bg-ink-200" />
            </div>

            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-ink-950 mt-5">
              Our Developer Team
            </h2>

            <p className="mt-6 text-lg text-ink-500 leading-8">
              Behind every thoughtful feature is a team that cares about the
              details. Our founders bring together technology, operations,
              creativity and business to build QuadraConverter with purpose.
            </p>
          </div>

          {/* =====================================================
              TEAM GRID
          ===================================================== */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-14 mt-16 md:mt-20">
            {teamMembers.map((member) => {
              const Icon = member.icon;

              return (
                <div
                  key={member.name}
                  className="group text-center"
                >
                  {/* Profile Image Area */}
                  <div className="relative mx-auto w-[230px] h-[230px] sm:w-[240px] sm:h-[240px]">
                    {/* Outer soft glow */}
                    <div className="absolute inset-[-10px] rounded-full bg-white shadow-[0_12px_45px_rgba(15,23,42,0.08)] transition-all duration-500 group-hover:shadow-[0_18px_55px_rgba(15,23,42,0.15)]" />

                    {/* Circular background */}
                    <div className="absolute inset-0 rounded-full bg-[#f1f2f7] overflow-hidden">
                      {/* Profile image */}
                      <img
                        src={member.image}
                        alt={member.name}
                        className="
                          w-full
                          h-full
                          object-cover
                          object-center
                          grayscale
                          transition-all
                          duration-700
                          ease-out
                          group-hover:grayscale-0
                          group-hover:scale-[1.06]
                        "
                      />

                      {/* Soft image overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/[0.08] via-transparent to-white/[0.08] opacity-40 group-hover:opacity-0 transition-opacity duration-500 pointer-events-none" />
                    </div>

                    {/* Floating icon */}
                    <div
                      className="
                        absolute
                        right-[-5px]
                        bottom-[8px]
                        w-[58px]
                        h-[58px]
                        rounded-full
                        bg-brand-500
                        border-[5px]
                        border-white
                        flex
                        items-center
                        justify-center
                        shadow-lg
                        transition-all
                        duration-500
                        group-hover:scale-110
                        group-hover:rotate-3
                      "
                    >
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                  </div>

                  {/* Name */}
                  <h3 className="mt-8 text-xl md:text-2xl font-bold text-ink-950 tracking-tight">
                    {member.name}
                  </h3>

                  {/* Role */}
                  <p className="mt-2 text-base font-medium text-brand-700">
                    {member.role}
                  </p>

                  {/* Description */}
                  <p className="mt-4 text-sm leading-6 text-ink-500 max-w-[280px] mx-auto">
                    {member.description}
                  </p>
                </div>
              );
            })}
          </div>

          {/* =====================================================
              TEAM PHILOSOPHY
          ===================================================== */}
          <div className="mt-24 md:mt-28 max-w-5xl mx-auto">
            <div className="relative overflow-hidden rounded-[2rem] bg-ink-950 px-7 py-10 md:px-12 md:py-14 text-white">
              {/* Background decoration */}
              <div className="absolute top-[-120px] right-[-80px] w-[280px] h-[280px] rounded-full border border-white/[0.06]" />
              <div className="absolute bottom-[-150px] left-[-100px] w-[320px] h-[320px] rounded-full border border-white/[0.05]" />

              <div className="relative z-10 grid md:grid-cols-[1fr_auto] gap-10 items-center">
                <div>
                  <span className="text-xs font-bold tracking-[0.18em] uppercase text-white/50">
                    ONE TEAM. ONE VISION.
                  </span>

                  <h3 className="text-2xl md:text-3xl font-bold mt-4">
                    Building something useful, together.
                  </h3>

                  <p className="text-white/65 mt-4 leading-7 max-w-2xl">
                    QuadraConverter is more than a collection of document
                    tools. It is an ongoing effort to make everyday digital
                    work simpler. Our team combines different strengths and
                    perspectives to create products that are practical,
                    reliable and genuinely pleasant to use.
                  </p>
                </div>

                <div className="hidden md:flex w-20 h-20 rounded-full border border-white/10 items-center justify-center">
                  <Users2 className="w-8 h-8 text-white/80" />
                </div>
              </div>
            </div>
          </div>

          {/* =====================================================
              SMALL CLOSING STATEMENT
          ===================================================== */}
          <div className="text-center mt-16">
            <p className="text-sm md:text-base text-ink-400">
              Thoughtfully designed. Carefully built.{" "}
              <span className="text-ink-700 font-medium">
                Made for the way you work.
              </span>
            </p>
          </div>
        </div>
      </section>

      {/* =========================================================
          FOOTER SPACE
          
          Your existing footer should remain BELOW this component.
          The developer team section therefore appears immediately
          before the footer when AboutPage is rendered.
      ========================================================= */}
    </div>
  );
}
