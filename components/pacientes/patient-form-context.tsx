'use client';

import { createContext, useContext } from 'react';

type Ctx = {
  open: boolean;
  setOpen: (v: boolean) => void;
  abrir: () => void;
} | null;

export const PatientFormContext = createContext<Ctx>(null);

export function usePatientFormContext() {
  return useContext(PatientFormContext);
}
