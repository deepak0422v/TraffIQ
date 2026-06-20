import {
  Camera,
  ScanSearch,
  BrainCircuit,
  Database,
  Users,
  ShieldCheck,
  ArrowRight,
  TrendingUp
} from "lucide-react";
import { Card, SectionTitle, Kpi } from "./ui";
import { useApp } from "./state";
import { AnimatedNumber } from "./AnimatedNumber";

const STAGES: {
  icon: typeof Camera;
  title: string;
  desc: string;
  status: "real" | "simulated";
}[] = [
    {
      icon: Camera,
      title: "CCTV Feed Ingestion",
      desc: "Traffic camera frames captured across BTP-monitored junctions",
      status: "simulated",
    },
    {
      icon: ScanSearch,
      title: "Vision Detection",
      desc: "Vehicle / violation type identification (helmet, parking, lane)",
      status: "simulated",
    },
    {
      icon: Database,
      title: "Violation Logging",
      desc: "Structured record: junction, vehicle type, timestamp, location",
      status: "real",
    },
    {
      icon: TrendingUp,
      title: "ML Forecasting Engine",
      desc: "CatBoost regression model forecasting violation intensity patterns",
      status: "real",
    },
    {
      icon: BrainCircuit,
      title: "Risk Scoring Engine",
      desc: "PDI + 24h Time-Aware Risk computed per junction, per hour",
      status: "real",
    },
    {
      icon: Users,
      title: "Officer Allocation Engine",
      desc: "Risk-proportional deployment across available officers",
      status: "real",
    },
    {
      icon: ShieldCheck,
      title: "Deployment Recommendation",
      desc: "Ranked, explainable enforcement plan delivered to command center",
      status: "real",
    },
  ];

export function AIEngine() {
  const { junctions, cityAvgPdi, hourlyRiskData } = useApp();

  const dataPoints = junctions.reduce((sum, j) => sum + j.violations, 0);
  const hourlyRows = hourlyRiskData.length;

  return (
    <div className="page-in space-y-6">

      <div>
        <h1 className="text-2xl font-bold">
          AI-Powered Traffic Intelligence Engine
        </h1>

        <p className="text-sm text-muted-foreground">
          How TraffIQ turns raw violation data into enforcement decisions — end to end.
        </p>
      </div>


      <div className="grid grid-cols-4 gap-4">

        <Kpi
          label="Junctions Monitored"
          value={<AnimatedNumber value={junctions.length} />}
          sub="Live, citywide"
        />

        <Kpi
          label="Violation Records Analyzed"
          value={<AnimatedNumber value={dataPoints} />}
          sub="BTP dataset"
        />

        <Kpi
          label="Hourly Risk Data Points"
          value={<AnimatedNumber value={hourlyRows} />}
          sub="24h × junction granularity"
        />

        <Kpi
          label="Avg City PDI"
          value={<AnimatedNumber value={cityAvgPdi} decimals={1} />}
          sub="Composite risk score"
          color="#f6ad55"
        />

      </div>


      <Card className="p-6">

        <SectionTitle right={
          <span className="text-xs text-muted-foreground">
            Source → Insight → Action
          </span>
        }>
          Enforcement Intelligence Pipeline
        </SectionTitle>


        <div className="flex items-stretch gap-2 overflow-x-auto pb-2">

          {STAGES.map((stage, i) => {

            const Icon = stage.icon;
            const isReal = stage.status === "real";

            return (

              <div
                key={stage.title}
                className="flex items-stretch gap-2 shrink-0"
              >

                <div
                  className="rounded-lg p-4 w-44 flex flex-col"
                  style={{
                    background: isReal
                      ? "rgba(0,212,255,0.06)"
                      : "rgba(160,174,192,0.05)",

                    border:
                      `1px solid ${isReal
                        ? "rgba(0,212,255,0.3)"
                        : "rgba(160,174,192,0.2)"
                      }`,
                  }}
                >

                  <Icon
                    size={22}
                    color={isReal ? "#00d4ff" : "#a0aec0"}
                  />


                  <div className="text-sm font-semibold mt-2 leading-snug">
                    {stage.title}
                  </div>


                  <div className="text-[11px] text-muted-foreground mt-1 leading-snug flex-1">
                    {stage.desc}
                  </div>


                  <span
                    className="text-[9px] font-bold tracking-wider uppercase mt-3 px-2 py-0.5 rounded-full self-start"
                    style={{
                      background: isReal
                        ? "rgba(104,211,145,0.15)"
                        : "rgba(246,173,85,0.15)",

                      color: isReal
                        ? "#68d391"
                        : "#f6ad55",
                    }}
                  >

                    {isReal
                      ? "Live · Data-Driven"
                      : "Planned Production Module"}

                  </span>


                </div>


                {i < STAGES.length - 1 && (

                  <div className="flex items-center">

                    <ArrowRight
                      size={18}
                      color="#4a5568"
                    />

                  </div>

                )}

              </div>

            );

          })}

        </div>


        <div
          className="text-[11px] text-muted-foreground mt-4 leading-relaxed border-t pt-3"
          style={{ borderColor: "rgba(0,212,255,0.1)" }}
        >

          <b className="text-foreground/80">
            Honest scope note:
          </b>

          {" "}
          the BTP dataset powering TraffIQ contains pre-logged violation records
          (junction, vehicle type, timestamp) rather than raw camera footage, so
          the CCTV ingestion and vision-detection stages above are presented as
          the intended production front end, not as something currently running
          on live video.

          <br /><br />

          Every stage from{" "}
          <b className="text-foreground/80">
            Violation Logging
          </b>{" "}
          onward — including ML-based violation forecasting, risk scoring,
          officer allocation, and deployment recommendation — is computed from
          the Bengaluru Traffic Police dataset and powers the operational
          intelligence presented throughout TraffIQ.

        </div>

      </Card>



      <div className="grid grid-cols-4 gap-6">


        <Card className="p-5">

          <SectionTitle>
            Risk Scoring Engine
          </SectionTitle>


          <p className="text-xs text-muted-foreground leading-relaxed mb-3">

            Every junction gets a Parking Disruption Index (PDI) and a 24-hour
            time-aware risk profile, recomputed from violation frequency,
            peak-hour concentration, heavy-vehicle impact, and recurrence.

          </p>


          <div
            className="text-[10px] font-mono leading-relaxed"
            style={{ color: "#a0aec0" }}
          >

            PDI = 0.45·Freq + 0.25·Peak<br />

            &nbsp;&nbsp;&nbsp;+ 0.10·Heavy + 0.20·Recur

          </div>

        </Card>



        <Card className="p-5">

          <SectionTitle>
            ML Forecasting Engine
          </SectionTitle>


          <p className="text-xs text-muted-foreground leading-relaxed mb-3">

            CatBoost Regressor predicts expected violation intensity using
            historical traffic behavior, temporal patterns, lag features,
            rolling averages, and recurrence indicators extracted from the
            Bengaluru Traffic Police dataset.

          </p>


          <div
            className="text-[10px] font-mono leading-relaxed"
            style={{ color: "#a0aec0" }}
          >

            Model: CatBoostRegressor<br />

            Target: Violation Count<br />

            Features: 14<br />

            Validation R²: 0.23

          </div>


        </Card>



        <Card className="p-5">

          <SectionTitle>
            Officer Allocation Engine
          </SectionTitle>


          <p className="text-xs text-muted-foreground leading-relaxed mb-3">

            Available officers are distributed proportionally to each junction's
            live risk share — not split evenly, not assigned manually.
            Higher risk, more officers, automatically re-ranked every hour.

          </p>


          <div
            className="text-[10px] font-mono leading-relaxed"
            style={{ color: "#a0aec0" }}
          >

            officers(j) = round(<br />

            &nbsp;&nbsp;risk(j) ÷ Σrisk × available<br />

            )

          </div>

        </Card>




        <Card className="p-5">

          <SectionTitle>
            Explainability Layer
          </SectionTitle>


          <p className="text-xs text-muted-foreground leading-relaxed mb-3">

            Every recommendation is traceable: each junction's selection
            reasons (volume, growth trend, spike pattern, recurrence) are
            surfaced in plain language on the Junction Intelligence page —
            not a black-box score.

          </p>


          <div className="text-[10px] text-muted-foreground">

            See:
            <span style={{ color: "#00d4ff" }}>
              {" "}Junction Intelligence → "Why was this hotspot selected?"
            </span>

          </div>


        </Card>


      </div>


    </div>
  );
}