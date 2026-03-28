import type { OnbordaProps } from "onborda";

type Tour = OnbordaProps["steps"][number];

const hl = "font-semibold text-primary";

export const tourSteps: Tour[] = [
  {
    tour: "routes-intro",
    steps: [
      {
        icon: <>&#128663;</>,
        title: "Trip Mode",
        content: (
          <p>
            Choose between <span className={hl}>Round Trip</span> (out and back) or{" "}
            <span className={hl}>One Way</span> routing.
          </p>
        ),
        selector: "#onborda-trip-mode",
        side: "bottom",
        showControls: true,
        pointerPadding: 4,
        pointerRadius: 24,
      },
      {
        icon: <>&#128205;</>,
        title: "Set Your Origin",
        content: (
          <p>
            Select a <span className={hl}>starting city</span> to see available routes from that location.
            This is the only required field to begin searching.
          </p>
        ),
        selector: "#onborda-origin",
        side: "bottom",
        showControls: true,
        pointerPadding: 4,
        pointerRadius: 24,
      },
      {
        icon: <>&#128722;</>,
        title: "Number of Loads",
        content: (
          <p>
            Set how many <span className={hl}>loads</span> (stops) you want in a route. More loads can mean
            better revenue but longer trips.
          </p>
        ),
        selector: "#onborda-legs",
        side: "bottom",
        showControls: true,
        pointerPadding: 4,
        pointerRadius: 24,
      },
      {
        icon: <>&#127968;</>,
        title: "Home By Date",
        content: (
          <p>
            Set a date you need to be <span className={hl}>home by</span>. Routes that can&apos;t get you back
            in time will be filtered out.
          </p>
        ),
        selector: "#onborda-home-by",
        side: "bottom",
        showControls: true,
        pointerPadding: 4,
        pointerRadius: 24,
      },
      {
        icon: <>&#9200;</>,
        title: "Max Idle Time",
        content: (
          <p>
            Limit <span className={hl}>idle time</span> between loads. Lower values keep you moving but may
            reduce available routes.
          </p>
        ),
        selector: "#onborda-idle",
        side: "bottom",
        showControls: true,
        pointerPadding: 4,
        pointerRadius: 24,
      },
      {
        icon: <>&#128739;</>,
        title: "Max Deadhead",
        content: (
          <p>
            Control how far you&apos;re willing to <span className={hl}>drive empty</span> between loads,
            as a percentage of the total trip. We recommend staying below <span className={hl}>15%</span>.
          </p>
        ),
        selector: "#onborda-deadhead",
        side: "bottom",
        showControls: true,
        pointerPadding: 4,
        pointerRadius: 24,
      },
      {
        icon: <>&#9881;</>,
        title: "All Filters",
        content: (
          <p>
            Fine-tune your search with <span className={hl}>trailer type</span>, <span className={hl}>weight limits</span>,{" "}
            <span className={hl}>hazmat</span>, <span className={hl}>TWIC</span>, <span className={hl}>risk</span>, and{" "}
            <span className={hl}>work days</span>. Set your work days to avoid routes
            that require pickups or deliveries on your off days.
          </p>
        ),
        selector: "#onborda-all-filters",
        side: "bottom",
        showControls: true,
        pointerPadding: 4,
        pointerRadius: 24,
      },
    ],
  },
];
