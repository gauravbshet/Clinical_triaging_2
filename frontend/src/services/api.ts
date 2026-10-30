import axios from "axios";
import type {
  Patient,
  Vital,
  News2Assessment,
  DeteriorationAlert,
  QualityWatchdogResponse,
} from "../types";

export const API = "http://127.0.0.1:8000";

export const api = axios.create({
  baseURL: API,
  timeout: 10000,
});

export const patientService = {
  list: async () =>
    (await api.get<Patient[]>("/patients")).data,

  get: async (id: number) =>
    (await api.get<Patient>(`/patients/${id}`)).data,

  create: async (data: { patient_code: string; age: number }) =>
    (await api.post<Patient>("/patients", data)).data,

  vitals: async (id: number) =>
    (await api.get<Vital[]>(`/patients/${id}/vitals`)).data,

  news2: async (id: number) =>
    (await api.get<News2Assessment>(`/patients/${id}/news2`)).data,
  createVital: async (
  id: number,
  data: {
    heart_rate: number | null;
    spo2: number | null;
    respiratory_rate: number | null;
    systolic_bp: number | null;
    temperature: number | null;
    consciousness: string | null;
    supplemental_oxygen: string | null;
    recorded_at: string;
    source: string;
  }
) =>
  (await api.post<Vital>(`/patients/${id}/vitals`, data)).data,
};

export const alertService = {
  list: async () =>
    (await api.get<DeteriorationAlert[]>("/alerts")).data,

  acknowledge: async (
  id: number,
  actor: string,
  note?: string
) =>
  (
    await api.post(`/alerts/${id}/acknowledge`, {
      actor,
      note: note ?? null,
    })
  ).data,

  audit: async (id: number) =>
    (await api.get(`/alerts/${id}/audit`)).data,
};

export const simulationService = {
  run: async () =>
    (await api.post("/test/simulate-waiting-room")).data,
};
export const qualityService = {
  watchdog: async () =>
    (await api.get<QualityWatchdogResponse>("/quality/watchdog")).data,
};