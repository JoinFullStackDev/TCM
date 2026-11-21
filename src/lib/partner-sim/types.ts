/**
 * Shapes from FullStackRx's Partner API v1 contract (partner-v1.openapi.json).
 * Only what the simulator reads or writes is typed; everything else passes through.
 */

export interface PartnerAddress {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zip: string;
}

export interface PartnerPatient {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  sex: 'F' | 'M' | 'U' | string;
  phone?: string;
  email?: string;
  shipTo: PartnerAddress;
  allergies: string[];
  conditions?: string[];
  medications?: string[];
}

export interface PartnerPrescriber {
  npi: string;
  firstName: string;
  lastName: string;
  stateLicense: { state: string; number: string };
}

export interface PartnerOrderItemInput {
  sku: string;
  quantity?: number;
  sig: string;
  daysSupply?: number;
  refillOf?: string | null;
  clinicalRationale?: { code?: string; text: string };
}

export interface PartnerOrderRequest {
  partnerOrderId: string;
  patient: PartnerPatient;
  prescriber: PartnerPrescriber;
  encounter: { date: string; modality: 'sync' | 'async' | string };
  items: PartnerOrderItemInput[];
  payment: { status: string };
  shippingMethod: string;
  attestations: { validRelationship?: boolean; prescriberSigned?: boolean };
}

export interface PartnerConnection {
  id?: string;
  pharmacyName?: string;
  partnerName?: string;
  status?: string;
  livemode?: boolean;
  payer?: string;
  allowedStates?: string[];
  events?: string[];
  sendsTracking?: boolean;
}

export interface PartnerCatalogItem {
  sku: string;
  productName?: string;
  variationName?: string | null;
  dosageForm?: string | null;
  priceCents?: number;
  currency?: string;
  rationaleRequired?: boolean;
  available?: boolean;
  maxQuantity?: number | null;
}

export interface PartnerShippingMethod {
  code: string;
  label?: string;
  priceCents?: number;
}

export interface PartnerCatalog {
  items?: PartnerCatalogItem[];
  shippingMethods?: PartnerShippingMethod[];
  allowedStates?: string[];
  updatedAt?: string;
}

export interface PartnerOrderItemStatus {
  id?: string;
  lineNumber?: number;
  sku?: string;
  quantity?: number;
  status?: string;
  carrier?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  updatedAt?: string;
}

export interface PartnerOrderResponse {
  id?: string;
  partnerOrderId?: string;
  status?: string;
  attention?: { reasonCode?: string; reason?: string } | null;
  livemode?: boolean;
  createdAt?: string;
  items?: PartnerOrderItemStatus[];
}

export interface PartnerProblem {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  code?: string;
  errors?: { field?: string; message?: string }[];
}

export interface PartnerWebhookEvent {
  id: string;
  type: string;
  createdAt: string;
  livemode: boolean;
  data: Record<string, unknown>;
}

/** The simulator's own presets for the order builder. */
export type OrderPreset =
  | 'happy_path'
  | 'new_prescriber'
  | 'bad_npi'
  | 'disallowed_state'
  | 'unknown_sku'
  | 'duplicate_order'
  | 'not_prepaid'
  | 'missing_attestation';
