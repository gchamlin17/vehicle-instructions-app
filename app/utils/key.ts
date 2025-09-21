export const toDocId = (key: string) => key.replace(/\//g, "__");

export const titleFromVehicle = (data: {
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  vehicleKey?: string;
}) => {
  const t = [data.year, data.make, data.model, data.trim].filter(Boolean).join(" ");
  return t || data.vehicleKey || "Vehicle";
};