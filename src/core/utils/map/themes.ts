import type { Theme } from "protomaps-themes-base";

/**
 * Moonlight theme — monochrome light gray map matching the original Mapbox Moonlight style.
 * Light background (#e5e5e5) with dark features (#1a1a1a) at varying opacities.
 */
export const MOONLIGHT_THEME: Theme = {
  background: "#e5e5e5",
  earth: "#dcdcdc",

  // Landuse — subtle variations on light gray
  park_a: "#d4d4d4",
  park_b: "#d0d0d0",
  hospital: "#d8d8d8",
  industrial: "#d6d6d6",
  school: "#d8d8d8",
  wood_a: "#d2d2d2",
  wood_b: "#cecece",
  pedestrian: "#d8d8d8",
  scrub_a: "#d4d4d4",
  scrub_b: "#d0d0d0",
  glacier: "#e0e0e0",
  sand: "#d8d8d8",
  beach: "#d6d6d6",
  aerodrome: "#d6d6d6",
  runway: "#c8c8c8",
  water: "#1a1a1a",
  zoo: "#d4d4d4",
  military: "#d6d6d6",

  // Tunnels
  tunnel_other_casing: "#c8c8c8",
  tunnel_minor_casing: "#c8c8c8",
  tunnel_link_casing: "#c8c8c8",
  tunnel_major_casing: "#c0c0c0",
  tunnel_highway_casing: "#b8b8b8",
  tunnel_other: "#d0d0d0",
  tunnel_minor: "#d0d0d0",
  tunnel_link: "#cccccc",
  tunnel_major: "#c8c8c8",
  tunnel_highway: "#c0c0c0",

  // Buildings
  pier: "#d0d0d0",
  buildings: "#d0d0d0",

  // Road casing (borders)
  minor_service_casing: "#c8c8c8",
  minor_casing: "#c0c0c0",
  link_casing: "#b8b8b8",
  major_casing_late: "#b0b0b0",
  highway_casing_late: "#a0a0a0",
  major_casing_early: "#c0c0c0",
  highway_casing_early: "#b0b0b0",

  // Road surfaces — dark lines on light background, matching Moonlight's monochrome
  other: "#b8b8b8",
  minor_service: "#c0c0c0",
  minor_a: "#b0b0b0",
  minor_b: "#b0b0b0",
  link: "#a0a0a0",
  major: "#808080",
  highway: "#585858",

  // Rail & boundaries
  railway: "#a0a0a0",
  boundaries: "#a0a0a0",

  // Bridges
  bridges_other_casing: "#c0c0c0",
  bridges_minor_casing: "#b8b8b8",
  bridges_link_casing: "#b0b0b0",
  bridges_major_casing: "#a0a0a0",
  bridges_highway_casing: "#909090",
  bridges_other: "#b8b8b8",
  bridges_minor: "#b0b0b0",
  bridges_link: "#a0a0a0",
  bridges_major: "#808080",
  bridges_highway: "#585858",

  // Labels — dark text on light background
  roads_label_minor: "#6a6a6a",
  roads_label_major: "#4a4a4a",
  ocean_label: "#e5e5e5",
  subplace_label: "#6a6a6a",
  city_label: "#3a3a3a",
  state_label: "#5a5a5a",
  country_label: "#4a4a4a",
  address_label: "#7a7a7a",

  // Label halos — light background
  roads_label_minor_halo: "#e5e5e5",
  roads_label_major_halo: "#e5e5e5",
  subplace_label_halo: "#e5e5e5",
  city_label_halo: "#e5e5e5",
  state_label_halo: "#e5e5e5",
  address_label_halo: "#e5e5e5",

  // Deprecated but required
  peak_label: "#6a6a6a",
  waterway_label: "#e5e5e5",
};

/**
 * Dark theme — monochrome dark map for dark mode.
 * Dark background with lighter features for contrast.
 */
export const DARK_THEME: Theme = {
  background: "#1a1a1a",
  earth: "#222222",

  // Landuse
  park_a: "#2a2a2a",
  park_b: "#282828",
  hospital: "#262626",
  industrial: "#242424",
  school: "#262626",
  wood_a: "#282828",
  wood_b: "#2a2a2a",
  pedestrian: "#262626",
  scrub_a: "#282828",
  scrub_b: "#2a2a2a",
  glacier: "#303030",
  sand: "#2a2a2a",
  beach: "#2c2c2c",
  aerodrome: "#242424",
  runway: "#383838",
  water: "#000000",
  zoo: "#282828",
  military: "#222222",

  // Tunnels
  tunnel_other_casing: "#1a1a1a",
  tunnel_minor_casing: "#1a1a1a",
  tunnel_link_casing: "#1a1a1a",
  tunnel_major_casing: "#1a1a1a",
  tunnel_highway_casing: "#1a1a1a",
  tunnel_other: "#303030",
  tunnel_minor: "#303030",
  tunnel_link: "#343434",
  tunnel_major: "#383838",
  tunnel_highway: "#404040",

  // Buildings
  pier: "#2a2a2a",
  buildings: "#2a2a2a",

  // Road casing
  minor_service_casing: "#1a1a1a",
  minor_casing: "#1a1a1a",
  link_casing: "#1a1a1a",
  major_casing_late: "#1a1a1a",
  highway_casing_late: "#1a1a1a",
  major_casing_early: "#1a1a1a",
  highway_casing_early: "#1a1a1a",

  // Road surfaces — light lines on dark background
  other: "#383838",
  minor_service: "#343434",
  minor_a: "#404040",
  minor_b: "#404040",
  link: "#484848",
  major: "#585858",
  highway: "#707070",

  // Rail & boundaries
  railway: "#404040",
  boundaries: "#484848",

  // Bridges
  bridges_other_casing: "#1a1a1a",
  bridges_minor_casing: "#1a1a1a",
  bridges_link_casing: "#1a1a1a",
  bridges_major_casing: "#1a1a1a",
  bridges_highway_casing: "#1a1a1a",
  bridges_other: "#383838",
  bridges_minor: "#404040",
  bridges_link: "#484848",
  bridges_major: "#585858",
  bridges_highway: "#707070",

  // Labels — light text on dark background
  roads_label_minor: "#808080",
  roads_label_major: "#909090",
  ocean_label: "#1a1a1a",
  subplace_label: "#808080",
  city_label: "#b0b0b0",
  state_label: "#909090",
  country_label: "#a0a0a0",
  address_label: "#707070",

  // Label halos — dark background
  roads_label_minor_halo: "#1a1a1a",
  roads_label_major_halo: "#1a1a1a",
  subplace_label_halo: "#1a1a1a",
  city_label_halo: "#1a1a1a",
  state_label_halo: "#1a1a1a",
  address_label_halo: "#1a1a1a",

  // Deprecated but required
  peak_label: "#808080",
  waterway_label: "#1a1a1a",
};
