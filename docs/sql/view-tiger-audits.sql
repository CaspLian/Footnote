-- Gemini/Snowflake analyses: all stored columns, full JSON response, and all normalized lines.
SELECT a.*,
       COALESCE((
           SELECT jsonb_agg(to_jsonb(l) ORDER BY l.position)
           FROM public.bill_analysis_lines AS l
           WHERE l.audit_id = a.audit_id
       ), '[]'::jsonb) AS normalized_line_items
FROM public.bill_analyses AS a
ORDER BY a.created_at DESC;

-- Operational claim records are separate from the analysis audit IDs.
-- Include every line and workflow event without multiplying rows in a three-way join.
SELECT a.*,
       COALESCE((
           SELECT jsonb_agg(to_jsonb(l) ORDER BY l.position)
           FROM public.audit_line_items AS l WHERE l.audit_id = a.audit_id
       ), '[]'::jsonb) AS line_items,
       COALESCE((
           SELECT jsonb_agg(to_jsonb(e) ORDER BY e.occurred_at, e.event_id)
           FROM public.audit_events AS e WHERE e.audit_id = a.audit_id
       ), '[]'::jsonb) AS events
FROM public.audit_records AS a
ORDER BY a.created_at DESC;
