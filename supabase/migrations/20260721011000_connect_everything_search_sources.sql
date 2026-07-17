-- Everything Search source adapters and automatic synchronization.

begin;

create or replace function public.index_loombus_search_payload(
  target_source_table text,
  payload jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_entity_id uuid;
  target_parent_id uuid;
  target_room_id uuid;
  target_owner_id uuid;
  target_entity_type text;
  target_title text;
  target_summary text := '';
  target_body text := '';
  target_keywords text[] := '{}'::text[];
  target_href text;
  target_visibility text := 'public';
  target_status text := 'active';
  target_signal numeric(8, 2) := 0;
  target_metadata jsonb := '{}'::jsonb;
  target_created_at timestamptz;
  target_updated_at timestamptz;
  parent_title text;
  parent_topic text;
  parent_deleted_at timestamptz;
  room_name text;
  module_key text;
  attachment_kind text;
  mime_type text;
  username_value text;
begin
  if payload is null then
    return;
  end if;

  begin
    target_entity_id := nullif(payload ->> 'id', '')::uuid;
  exception
    when invalid_text_representation then return;
  end;

  if target_entity_id is null then
    return;
  end if;

  if nullif(payload ->> 'deleted_at', '') is not null
    or nullif(payload ->> 'archived_at', '') is not null
    or lower(coalesce(payload ->> 'status', '')) in ('deleted', 'pending_deletion')
    or lower(coalesce(payload ->> 'is_current', 'true')) = 'false'
  then
    delete from public.loombus_search_documents document
    where document.source_table = target_source_table
      and document.entity_id = target_entity_id;
    return;
  end if;

  begin
    target_created_at := nullif(payload ->> 'created_at', '')::timestamptz;
  exception
    when others then target_created_at := now();
  end;

  begin
    target_updated_at := coalesce(
      nullif(payload ->> 'updated_at', '')::timestamptz,
      target_created_at
    );
  exception
    when others then target_updated_at := target_created_at;
  end;

  if coalesce(payload ->> 'signal_score', '') ~ '^[0-9]+([.][0-9]+)?$' then
    target_signal := least(greatest((payload ->> 'signal_score')::numeric, 0), 100);
  end if;

  case target_source_table
    when 'discussions' then
      target_entity_type := 'discussion';
      target_owner_id := nullif(payload ->> 'user_id', '')::uuid;
      target_title := coalesce(nullif(trim(payload ->> 'title'), ''), 'Loombus discussion');
      target_summary := concat_ws(
        ' · ',
        nullif(trim(payload ->> 'topic'), ''),
        nullif(trim(payload ->> 'purpose_lane'), ''),
        nullif(trim(payload ->> 'reality_lens'), '')
      );
      target_body := coalesce(payload ->> 'body', '');
      target_keywords := array_remove(array[
        payload ->> 'topic',
        payload ->> 'purpose_lane',
        payload ->> 'reality_lens',
        payload ->> 'discussion_type'
      ], null);
      target_href := '/discussions/' || target_entity_id::text;
      target_visibility := 'public';
      target_metadata := jsonb_strip_nulls(jsonb_build_object(
        'topic', payload ->> 'topic',
        'purposeLane', payload ->> 'purpose_lane',
        'realityLens', payload ->> 'reality_lens',
        'discussionType', payload ->> 'discussion_type',
        'discussionStatus', payload ->> 'discussion_status'
      ));

    when 'replies' then
      target_parent_id := nullif(payload ->> 'discussion_id', '')::uuid;
      select discussion.title, discussion.topic, discussion.deleted_at
      into parent_title, parent_topic, parent_deleted_at
      from public.discussions discussion
      where discussion.id = target_parent_id;

      if parent_title is null or parent_deleted_at is not null then
        delete from public.loombus_search_documents document
        where document.source_table = target_source_table
          and document.entity_id = target_entity_id;
        return;
      end if;

      target_entity_type := 'reply';
      target_owner_id := nullif(payload ->> 'user_id', '')::uuid;
      target_title := left('Reply in ' || parent_title, 300);
      target_summary := coalesce(parent_topic, '');
      target_body := coalesce(payload ->> 'body', '');
      target_keywords := array_remove(array[parent_topic, 'reply'], null);
      target_href := '/discussions/' || target_parent_id::text || '#reply-' || target_entity_id::text;
      target_visibility := 'public';
      target_metadata := jsonb_build_object('discussionId', target_parent_id);

    when 'discussion_summaries' then
      target_parent_id := nullif(payload ->> 'discussion_id', '')::uuid;
      select discussion.title, discussion.topic, discussion.deleted_at
      into parent_title, parent_topic, parent_deleted_at
      from public.discussions discussion
      where discussion.id = target_parent_id;

      if parent_title is null or parent_deleted_at is not null then
        delete from public.loombus_search_documents document
        where document.source_table = target_source_table
          and document.entity_id = target_entity_id;
        return;
      end if;

      target_entity_type := 'knowledge';
      target_title := left('AI summary: ' || parent_title, 300);
      target_summary := coalesce(parent_topic, '');
      target_body := coalesce(payload ->> 'summary', '');
      target_keywords := array_remove(array[parent_topic, 'summary', 'AI knowledge'], null);
      target_href := '/discussions/' || target_parent_id::text;
      target_visibility := 'premium';
      target_metadata := jsonb_strip_nulls(jsonb_build_object(
        'discussionId', target_parent_id,
        'modelName', payload ->> 'model_name',
        'sourceReplyCount', payload ->> 'source_reply_count'
      ));

    when 'discussion_attachments' then
      target_parent_id := nullif(payload ->> 'discussion_id', '')::uuid;
      select discussion.title, discussion.topic, discussion.deleted_at
      into parent_title, parent_topic, parent_deleted_at
      from public.discussions discussion
      where discussion.id = target_parent_id;

      if parent_title is null or parent_deleted_at is not null then
        delete from public.loombus_search_documents document
        where document.source_table = target_source_table
          and document.entity_id = target_entity_id;
        return;
      end if;

      attachment_kind := lower(coalesce(payload ->> 'attachment_kind', 'file'));
      mime_type := lower(coalesce(payload ->> 'mime_type', ''));
      target_entity_type := case
        when attachment_kind = 'image' then 'image'
        when attachment_kind = 'video' then 'video'
        when attachment_kind = 'pdf' or mime_type = 'application/pdf' then 'document'
        else 'file'
      end;
      target_title := coalesce(nullif(trim(payload ->> 'file_name'), ''), parent_title || ' attachment');
      target_summary := concat_ws(' · ', parent_title, parent_topic, mime_type);
      target_body := '';
      target_keywords := array_remove(array[parent_topic, attachment_kind, mime_type], null);
      target_href := '/discussions/' || target_parent_id::text;
      target_visibility := 'public';
      target_metadata := jsonb_strip_nulls(jsonb_build_object(
        'discussionId', target_parent_id,
        'publicUrl', payload ->> 'public_url',
        'mimeType', mime_type,
        'attachmentKind', attachment_kind,
        'fileSizeBytes', payload ->> 'file_size_bytes',
        'videoDurationSeconds', payload ->> 'video_duration_seconds'
      ));

    when 'profiles' then
      if lower(coalesce(payload ->> 'account_status', 'active'))
        in ('blocked', 'deleted', 'deactivated', 'suspended')
      then
        delete from public.loombus_search_documents document
        where document.source_table = target_source_table
          and document.entity_id = target_entity_id;
        return;
      end if;

      username_value := nullif(trim(payload ->> 'username'), '');
      target_entity_type := 'person';
      target_owner_id := target_entity_id;
      target_title := coalesce(
        nullif(trim(payload ->> 'full_name'), ''),
        username_value,
        'Loombus member'
      );
      target_summary := case
        when username_value is not null then '@' || username_value
        else ''
      end;
      target_body := coalesce(payload ->> 'bio', '');
      target_keywords := array_remove(array[
        username_value,
        payload ->> 'full_name',
        payload ->> 'location',
        payload ->> 'occupation'
      ], null);
      target_href := case
        when username_value is not null then '/u/' || username_value
        else '/people'
      end;
      target_visibility := 'authenticated';
      target_metadata := jsonb_strip_nulls(jsonb_build_object(
        'username', username_value,
        'identityVerificationStatus', payload ->> 'identity_verification_status'
      ));

    when 'rooms' then
      target_entity_type := 'room';
      target_room_id := target_entity_id;
      target_owner_id := coalesce(
        nullif(payload ->> 'owner_id', '')::uuid,
        nullif(payload ->> 'created_by', '')::uuid
      );
      target_title := coalesce(nullif(trim(payload ->> 'name'), ''), 'Loombus Room');
      target_summary := coalesce(payload ->> 'description', '');
      target_body := concat_ws(
        ' ',
        payload ->> 'room_type',
        payload ->> 'template_key',
        payload ->> 'subscription_plan'
      );
      target_keywords := array_remove(array[
        payload ->> 'room_type',
        payload ->> 'template_key',
        'Room',
        'community'
      ], null);
      target_href := '/rooms/' || target_entity_id::text;
      target_visibility := 'member';
      target_metadata := jsonb_strip_nulls(jsonb_build_object(
        'roomType', payload ->> 'room_type',
        'templateKey', payload ->> 'template_key'
      ));

    when 'room_posts' then
      target_room_id := nullif(payload ->> 'room_id', '')::uuid;
      select room.name into room_name from public.rooms room where room.id = target_room_id;
      target_entity_type := 'room_discussion';
      target_owner_id := nullif(payload ->> 'author_id', '')::uuid;
      target_title := coalesce(nullif(trim(payload ->> 'title'), ''), 'Room discussion');
      target_summary := coalesce(room_name, 'Private Room');
      target_body := coalesce(payload ->> 'body', '');
      target_keywords := array_remove(array[room_name, 'Room discussion'], null);
      target_href := '/rooms/' || target_room_id::text;
      target_visibility := 'member';
      target_metadata := jsonb_build_object('roomId', target_room_id);

    when 'room_announcements' then
      target_room_id := nullif(payload ->> 'room_id', '')::uuid;
      select room.name into room_name from public.rooms room where room.id = target_room_id;
      target_entity_type := 'announcement';
      target_owner_id := nullif(payload ->> 'created_by', '')::uuid;
      target_title := coalesce(nullif(trim(payload ->> 'title'), ''), 'Room announcement');
      target_summary := concat_ws(' · ', room_name, payload ->> 'priority');
      target_body := coalesce(payload ->> 'body', '');
      target_keywords := array_remove(array[room_name, payload ->> 'priority', 'announcement'], null);
      target_href := '/rooms/' || target_room_id::text;
      target_visibility := 'member';
      target_metadata := jsonb_strip_nulls(jsonb_build_object(
        'roomId', target_room_id,
        'priority', payload ->> 'priority',
        'isPinned', payload ->> 'is_pinned'
      ));

    when 'room_events' then
      target_room_id := nullif(payload ->> 'room_id', '')::uuid;
      select room.name into room_name from public.rooms room where room.id = target_room_id;
      target_entity_type := 'event';
      target_owner_id := nullif(payload ->> 'created_by', '')::uuid;
      target_title := coalesce(nullif(trim(payload ->> 'title'), ''), 'Room event');
      target_summary := concat_ws(
        ' · ',
        room_name,
        payload ->> 'location',
        payload ->> 'starts_at'
      );
      target_body := coalesce(payload ->> 'description', '');
      target_keywords := array_remove(array[
        room_name,
        payload ->> 'location',
        payload ->> 'timezone',
        'event'
      ], null);
      target_href := '/rooms/' || target_room_id::text;
      target_visibility := 'member';
      target_metadata := jsonb_strip_nulls(jsonb_build_object(
        'roomId', target_room_id,
        'location', payload ->> 'location',
        'startsAt', payload ->> 'starts_at',
        'endsAt', payload ->> 'ends_at',
        'timezone', payload ->> 'timezone',
        'capacity', payload ->> 'capacity'
      ));

    when 'room_module_records' then
      target_room_id := nullif(payload ->> 'room_id', '')::uuid;
      select room.name into room_name from public.rooms room where room.id = target_room_id;
      module_key := lower(coalesce(payload ->> 'module_key', 'resource'));
      target_entity_type := case module_key
        when 'service' then 'service'
        when 'knowledge' then 'knowledge'
        when 'task' then 'task'
        when 'poll' then 'poll'
        when 'form' then 'form'
        else 'resource'
      end;
      target_owner_id := nullif(payload ->> 'created_by', '')::uuid;
      target_title := coalesce(nullif(trim(payload ->> 'title'), ''), initcap(module_key));
      target_summary := concat_ws(' · ', room_name, payload ->> 'status');
      target_body := concat_ws(' ', payload ->> 'body', (payload -> 'metadata')::text);
      target_keywords := array_remove(array[
        room_name,
        module_key,
        payload ->> 'status'
      ], null);
      target_href := '/rooms/' || target_room_id::text;
      target_visibility := 'member';
      target_metadata := coalesce(payload -> 'metadata', '{}'::jsonb)
        || jsonb_strip_nulls(jsonb_build_object(
          'roomId', target_room_id,
          'moduleKey', module_key,
          'status', payload ->> 'status'
        ));

    when 'room_resources' then
      target_room_id := nullif(payload ->> 'room_id', '')::uuid;
      select room.name into room_name from public.rooms room where room.id = target_room_id;
      attachment_kind := lower(coalesce(payload ->> 'media_kind', 'file'));
      mime_type := lower(coalesce(payload ->> 'mime_type', ''));
      target_entity_type := case
        when attachment_kind = 'image' then 'image'
        when attachment_kind = 'video' then 'video'
        when mime_type = 'application/pdf' then 'document'
        else 'file'
      end;
      target_owner_id := nullif(payload ->> 'uploaded_by', '')::uuid;
      target_title := coalesce(nullif(trim(payload ->> 'file_name'), ''), 'Room file');
      target_summary := concat_ws(' · ', room_name, payload ->> 'folder_path', mime_type);
      target_body := '';
      target_keywords := array_remove(array[
        room_name,
        payload ->> 'folder_path',
        attachment_kind,
        mime_type
      ], null);
      target_href := '/rooms/' || target_room_id::text;
      target_visibility := 'member';
      target_metadata := jsonb_strip_nulls(jsonb_build_object(
        'roomId', target_room_id,
        'folderPath', payload ->> 'folder_path',
        'mimeType', mime_type,
        'mediaKind', attachment_kind,
        'fileSizeBytes', payload ->> 'file_size_bytes',
        'versionNumber', payload ->> 'version_number'
      ));

    else
      return;
  end case;

  if target_title is null or trim(target_title) = '' or target_href is null then
    return;
  end if;

  insert into public.loombus_search_documents (
    source_table,
    entity_type,
    entity_id,
    parent_id,
    room_id,
    owner_id,
    title,
    summary,
    body,
    keywords,
    href,
    visibility,
    status,
    signal_score,
    metadata,
    source_created_at,
    source_updated_at
  )
  values (
    target_source_table,
    target_entity_type,
    target_entity_id,
    target_parent_id,
    target_room_id,
    target_owner_id,
    left(target_title, 300),
    left(coalesce(target_summary, ''), 2000),
    left(coalesce(target_body, ''), 20000),
    coalesce(target_keywords, '{}'::text[]),
    left(target_href, 500),
    target_visibility,
    target_status,
    target_signal,
    coalesce(target_metadata, '{}'::jsonb),
    target_created_at,
    target_updated_at
  )
  on conflict (source_table, entity_id)
  do update set
    entity_type = excluded.entity_type,
    parent_id = excluded.parent_id,
    room_id = excluded.room_id,
    owner_id = excluded.owner_id,
    title = excluded.title,
    summary = excluded.summary,
    body = excluded.body,
    keywords = excluded.keywords,
    href = excluded.href,
    visibility = excluded.visibility,
    status = excluded.status,
    signal_score = excluded.signal_score,
    metadata = excluded.metadata,
    source_created_at = excluded.source_created_at,
    source_updated_at = excluded.source_updated_at,
    updated_at = now();
end;
$$;

create or replace function public.sync_loombus_search_source()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  payload jsonb;
  target_id uuid;
begin
  if tg_op = 'DELETE' then
    payload := to_jsonb(old);
    begin
      target_id := nullif(payload ->> 'id', '')::uuid;
    exception
      when invalid_text_representation then return old;
    end;

    delete from public.loombus_search_documents document
    where document.source_table = tg_table_name
      and document.entity_id = target_id;

    return old;
  end if;

  perform public.index_loombus_search_payload(tg_table_name, to_jsonb(new));
  return new;
end;
$$;

do $$
declare
  source_table text;
begin
  foreach source_table in array array[
    'discussions',
    'replies',
    'discussion_summaries',
    'discussion_attachments',
    'profiles',
    'rooms',
    'room_posts',
    'room_announcements',
    'room_events',
    'room_module_records',
    'room_resources'
  ]
  loop
    execute format(
      'drop trigger if exists %I on public.%I',
      'sync_loombus_search_' || source_table,
      source_table
    );
    execute format(
      'create trigger %I
       after insert or update or delete on public.%I
       for each row execute function public.sync_loombus_search_source()',
      'sync_loombus_search_' || source_table,
      source_table
    );
  end loop;
end;
$$;

revoke all on function public.index_loombus_search_payload(text, jsonb)
  from public, anon, authenticated;

grant execute on function public.index_loombus_search_payload(text, jsonb)
  to service_role;

commit;
