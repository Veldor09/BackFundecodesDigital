-- Función slugify
CREATE OR REPLACE FUNCTION public.slugify(txt text)
RETURNS text AS $$
DECLARE
  s text := lower(trim(coalesce(txt, '')));
BEGIN
  s := translate(s,
    'ÁÀÂÄÃÅáàâäãåÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÖÕóòôöõÚÙÛÜúùûüÑñÇç',
    'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuNnCc'
  );
  s := regexp_replace(s, '[^a-z0-9]+', '-', 'g');
  s := regexp_replace(s, '-+', '-', 'g');
  s := regexp_replace(s, '(^-+|-+$)', '', 'g');
  RETURN s;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger para Project
CREATE OR REPLACE FUNCTION public.project_slug_before_write()
RETURNS trigger AS $$
BEGIN
  IF trim(COALESCE(NEW.title, '')) = '' THEN
    RAISE EXCEPTION 'title no puede estar vacío';
  END IF;
  IF trim(COALESCE(NEW.category, '')) = '' THEN
    RAISE EXCEPTION 'category no puede estar vacío';
  END IF;
  IF trim(COALESCE(NEW.place, '')) = '' THEN
    RAISE EXCEPTION 'place no puede estar vacío';
  END IF;
  IF trim(COALESCE(NEW.area, '')) = '' THEN
    RAISE EXCEPTION 'area no puede estar vacío';
  END IF;

  IF NEW.slug IS NULL OR trim(NEW.slug) = '' THEN
    NEW.slug := slugify(NEW.title) || '-' || slugify(NEW.place);
  ELSE
    NEW.slug := slugify(NEW.slug);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_project_slug_before_write ON "Project";
CREATE TRIGGER trg_project_slug_before_write
BEFORE INSERT OR UPDATE ON "Project"
FOR EACH ROW
EXECUTE FUNCTION public.project_slug_before_write();
