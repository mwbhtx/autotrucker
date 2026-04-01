import type { DriveStep } from "driver.js";

const hl = "font-semibold"; // driver.js uses inline HTML, not JSX

export const tourSteps: DriveStep[] = [
  {
    element: "#onborda-origin",
    popover: {
      title: "📍 Set Your Origin",
      description: `Select a <strong class="${hl}">starting city</strong> to see available routes from that location. This is the only required field to begin searching.`,
      side: "bottom",
      align: "center",
    },
  },
  {
    element: "#onborda-destination",
    popover: {
      title: "📍 Destination",
      description: `Optionally set a <strong class="${hl}">destination</strong> — where you want to end up. Leave it empty if you'll go anywhere, or set it to your home base to find routes that bring you back.`,
      side: "bottom",
      align: "center",
    },
  },
  {
    element: "#onborda-departure-date",
    popover: {
      title: "📅 Departure Date",
      description: `Set the <strong class="${hl}">date you want to leave</strong>. Routes are simulated starting at your work start hour on this date.`,
      side: "bottom",
      align: "center",
    },
  },
  {
    element: "#onborda-days-out",
    popover: {
      title: "🗓️ Days Out",
      description: `Set how many <strong class="${hl}">days</strong> you want to be on the road. Only routes that fit within this timeframe are shown. The return date is calculated automatically.`,
      side: "bottom",
      align: "center",
    },
  },
  {
    element: "#onborda-legs",
    popover: {
      title: "📦 Number of Loads",
      description: `Set how many <strong class="${hl}">loads</strong> (stops) you want in a route. More loads can mean better revenue but longer trips.`,
      side: "bottom",
      align: "center",
    },
  },
  {
    element: "#onborda-all-filters",
    popover: {
      title: "⚙️ All Filters",
      description: `Fine-tune your search with <strong class="${hl}">trailer type</strong>, <strong class="${hl}">weight limits</strong>, <strong class="${hl}">hazmat</strong>, <strong class="${hl}">TWIC</strong>, and <strong class="${hl}">work days</strong>. Set your work days to avoid routes that require pickups or deliveries on your off days.`,
      side: "bottom",
      align: "end",
    },
  },
];
