// Compatibility export for integrations that still import the old mission
// module. New code should import the data-driven objective engine directly.
export { progressObjectives as progressMission } from "./objectives";
