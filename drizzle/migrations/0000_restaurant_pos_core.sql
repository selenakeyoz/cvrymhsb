-- Roles
CREATE TYPE public.app_role AS ENUM ('yonetici', 'garson', 'mutfak', 'muhasebe');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  username text NOT NULL UNIQUE,
  full_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles readable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roles readable by authenticated" ON public.user_roles FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- Menu
CREATE TABLE public.menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'Diğer',
  price numeric(10,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_items TO authenticated;
GRANT ALL ON public.menu_items TO service_role;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "menu readable by authenticated" ON public.menu_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "menu managed by kitchen or admin" ON public.menu_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'mutfak') OR public.has_role(auth.uid(), 'yonetici'))
  WITH CHECK (public.has_role(auth.uid(), 'mutfak') OR public.has_role(auth.uid(), 'yonetici'));

-- Closed checks (adisyonlar)
CREATE TABLE public.checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  floor int NOT NULL,
  table_no int NOT NULL,
  total numeric(10,2) NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'nakit',
  note text,
  closed_at timestamptz NOT NULL DEFAULT now(),
  closed_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checks TO authenticated;
GRANT ALL ON public.checks TO service_role;
ALTER TABLE public.checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "checks readable by authenticated" ON public.checks FOR SELECT TO authenticated USING (true);
CREATE POLICY "checks insert by authenticated" ON public.checks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "checks note update by accounting or admin" ON public.checks FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'muhasebe') OR public.has_role(auth.uid(), 'yonetici'))
  WITH CHECK (public.has_role(auth.uid(), 'muhasebe') OR public.has_role(auth.uid(), 'yonetici'));

-- Order items
CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  floor int NOT NULL,
  table_no int NOT NULL,
  menu_item_id uuid REFERENCES public.menu_items(id) ON DELETE SET NULL,
  item_name text NOT NULL,
  unit_price numeric(10,2) NOT NULL DEFAULT 0,
  quantity int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'beklemede',
  note text,
  check_id uuid REFERENCES public.checks(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_items_open_idx ON public.order_items (floor, table_no) WHERE check_id IS NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders readable by authenticated" ON public.order_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "orders insert by authenticated" ON public.order_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "orders update by authenticated" ON public.order_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "orders delete by authenticated" ON public.order_items FOR DELETE TO authenticated USING (true);

-- Allowed networks (wifi / IP allowlist)
CREATE TABLE public.allowed_ips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip text NOT NULL UNIQUE,
  label text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.allowed_ips TO authenticated;
GRANT ALL ON public.allowed_ips TO service_role;
ALTER TABLE public.allowed_ips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ips readable by authenticated" ON public.allowed_ips FOR SELECT TO authenticated USING (true);

-- Daily closings synced to cloud storage
CREATE TABLE public.daily_closings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  closing_date date NOT NULL UNIQUE,
  total numeric(12,2) NOT NULL DEFAULT 0,
  check_count int NOT NULL DEFAULT 0,
  file_name text,
  content text,
  synced_at timestamptz,
  sync_status text NOT NULL DEFAULT 'beklemede',
  sync_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.daily_closings TO authenticated;
GRANT ALL ON public.daily_closings TO service_role;
ALTER TABLE public.daily_closings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "closings readable by authenticated" ON public.daily_closings FOR SELECT TO authenticated USING (true);

-- Realtime
ALTER TABLE public.order_items REPLICA IDENTITY FULL;
ALTER TABLE public.menu_items REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_items;

-- Örnek menü
INSERT INTO public.menu_items (name, category, price, sort_order) VALUES
('Çorba', 'Başlangıç', 65.00, 1),
('Mercimek Çorbası', 'Başlangıç', 70.00, 2),
('Çoban Salata', 'Başlangıç', 80.00, 3),
('Humus', 'Başlangıç', 90.00, 4),
('Adana Kebap', 'Ana Yemek', 320.00, 10),
('Urfa Kebap', 'Ana Yemek', 320.00, 11),
('Tavuk Şiş', 'Ana Yemek', 260.00, 12),
('Karışık Izgara', 'Ana Yemek', 480.00, 13),
('İskender', 'Ana Yemek', 350.00, 14),
('Lahmacun', 'Ana Yemek', 90.00, 15),
('Pide Kaşarlı', 'Ana Yemek', 160.00, 16),
('Pilav', 'Ara Sıcak', 55.00, 20),
('Patates Kızartması', 'Ara Sıcak', 70.00, 21),
('Sigara Böreği', 'Ara Sıcak', 85.00, 22),
('Baklava', 'Tatlı', 140.00, 30),
('Künefe', 'Tatlı', 150.00, 31),
('Sütlaç', 'Tatlı', 95.00, 32),
('Ayran', 'İçecek', 35.00, 40),
('Kola', 'İçecek', 45.00, 41),
('Su', 'İçecek', 20.00, 42),
('Çay', 'İçecek', 25.00, 43),
('Türk Kahvesi', 'İçecek', 60.00, 44);