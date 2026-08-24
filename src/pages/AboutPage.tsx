import {
  ShieldCheck,
  Heart,
  Target,
  Users2,
  Code2,
  Network,
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
    image: "dhana.png",
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

        {/* =========================================================
            TEAM SECTION
        ========================================================= */}
        <div className="mt-20">
          <div className="max-w-3xl">
            <span className="section-eyebrow">OUR TEAM</span>

            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mt-4 text-ink-950">
              The people behind QuadraConverter.
            </h2>

            <p className="text-ink-500 mt-4 leading-7">
              A focused team working together to create simple, reliable and
              secure digital document experiences.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-10">
            {teamMembers.map((member) => {
              const Icon = member.icon;

              return (
                <div
                  key={member.name}
                  className="card group overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                >
                  {/* Team Image */}
                  <div className="relative aspect-square overflow-hidden bg-brand-50">
                    <img
                      src={member.image}
                      alt={member.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />

                    <div className="absolute top-4 right-4 w-10 h-10 rounded-xl bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-sm">
                      <Icon className="w-5 h-5 text-brand-700" />
                    </div>
                  </div>

                  {/* Team Details */}
                  <div className="p-6">
                    <h3 className="font-bold text-lg text-ink-950">
                      {member.name}
                    </h3>

                    <p className="text-sm font-semibold text-brand-700 mt-1">
                      {member.role}
                    </p>

                    <p className="text-sm text-ink-500 leading-6 mt-4">
                      {member.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* =========================================================
            FINAL CTA
        ========================================================= */}
        <div className="mt-16 rounded-[2rem] border border-ink-100 bg-brand-50 p-8 md:p-12 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-ink-950">
            Simpler documents. Smarter workflows.
          </h2>

          <p className="text-ink-500 mt-4 max-w-2xl mx-auto leading-7">
            QuadraConverter brings the essential tools you need into one
            streamlined platform.
          </p>

          <a
            href="/"
            className="inline-flex items-center gap-2 mt-7 px-6 py-3 rounded-xl bg-brand-700 text-white font-semibold transition-all duration-300 hover:bg-brand-800 hover:-translate-y-0.5"
          >
            Explore QuadraConverter
            <ArrowUpRight className="w-4 h-4" />
          </a>
        </div>
      </section>
    </div>
  );
}
