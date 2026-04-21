import type {
  Alert,
  AlertCriteria,
  AlertMatchGroup,
  AlertMatchLiveStatus,
  AlertMatchOrderSnapshot,
  PhoneStatusResponse,
  PhoneVerificationStartResponse,
  PhoneVerificationVerifyResponse,
  UnreadMatchCountResponse,
} from "@mwbhtx/haulvisor-core";

export type {
  Alert,
  AlertCriteria,
  AlertMatchGroup,
  AlertMatchLiveStatus,
  AlertMatchOrderSnapshot,
  PhoneStatusResponse,
  PhoneVerificationStartResponse,
  PhoneVerificationVerifyResponse,
  UnreadMatchCountResponse,
};

export interface CreateAlertInput {
  name: string;
  criteria: AlertCriteria;
  rolling_window_hours?: number;
  sms_enabled?: boolean;
}

export interface UpdateAlertInput {
  name?: string;
  criteria?: AlertCriteria;
  rolling_window_hours?: number;
  active?: boolean;
  sms_enabled?: boolean;
}
