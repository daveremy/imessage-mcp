export interface ChatRow {
  ROWID: number;
  guid: string;
  display_name: string | null;
  style: number; // 43 = group, 45 = 1:1
  service_name: string | null;
  last_message_date: bigint | number | null;
  message_count: number;
  participant_count: number;
}

export interface MessageRow {
  ROWID: number;
  guid: string;
  text: string | null;
  attributedBody: Buffer | null;
  handle_id: number;
  is_from_me: number;
  date: bigint | number;
  date_read: bigint | number | null;
  date_delivered: bigint | number | null;
  date_edited: bigint | number | null;
  date_retracted: bigint | number | null;
  cache_has_attachments: number;
  associated_message_guid: string | null;
  associated_message_type: number;
  service: string | null;
}

export interface HandleRow {
  ROWID: number;
  id: string; // phone number or email
  service: string;
}

export interface AttachmentRow {
  filename: string | null;
  mime_type: string | null;
  total_bytes: number;
  transfer_name: string | null;
}

export interface ParticipantInfo {
  handle: string;
  name: string | null;
  service: string;
}

export interface PaginationCursor {
  date: string; // raw bigint as string
  rowid: number;
}
