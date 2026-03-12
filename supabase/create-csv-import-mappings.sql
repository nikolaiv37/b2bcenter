-- CSV Import Wizard: Multi-Distributor Support
-- Database tables for storing distributor mappings and category synonyms

-- Store column and category mappings per distributor
CREATE TABLE IF NOT EXISTS csv_distributor_mappings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  distributor_name VARCHAR(100) NOT NULL,  -- "B2BMarkt", "Megapap", "IKEA"
  column_mappings JSONB NOT NULL DEFAULT '{}',  -- {"Artikelnummer": "sku", "Produktname": "name"}
  category_mappings JSONB NOT NULL DEFAULT '{}',  -- {"Kleiderschrank": "Wardrobes"}
  detection_patterns JSONB DEFAULT '{}',  -- Patterns to auto-detect this distributor
  is_active BOOLEAN DEFAULT true,
  success_rate DECIMAL(5,2) DEFAULT 0.00,  -- Percentage of successful imports
  total_imports INTEGER DEFAULT 0,
  last_import_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Category synonyms for auto-matching across languages
CREATE TABLE IF NOT EXISTS category_synonyms (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  standard_category VARCHAR(255) NOT NULL,  -- Your normalized category name
  synonym VARCHAR(255) NOT NULL,  -- Alternative name (German, Dutch, Greek, etc.)
  language VARCHAR(10) DEFAULT 'en',  -- "de", "en", "nl", "el", "bg"
  distributor VARCHAR(100),  -- Optional: specific to a distributor
  confidence DECIMAL(3,2) DEFAULT 0.95,  -- Match confidence (0.00-1.00)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(synonym, distributor)  -- Same synonym can exist for different distributors
);

-- Import history for tracking and analytics
CREATE TABLE IF NOT EXISTS csv_import_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  distributor_name VARCHAR(100) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_size INTEGER,
  total_rows INTEGER NOT NULL,
  imported_rows INTEGER NOT NULL,
  skipped_rows INTEGER DEFAULT 0,
  failed_rows INTEGER DEFAULT 0,
  new_categories INTEGER DEFAULT 0,
  categories_mapped INTEGER DEFAULT 0,
  images_processed INTEGER DEFAULT 0,
  column_mapping_used JSONB,
  category_mapping_used JSONB,
  import_duration_seconds INTEGER,
  status VARCHAR(50) DEFAULT 'completed',  -- 'completed', 'partial', 'failed'
  error_details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_distributor_mappings_name ON csv_distributor_mappings(distributor_name);
CREATE INDEX IF NOT EXISTS idx_category_synonyms_synonym ON category_synonyms(synonym);
CREATE INDEX IF NOT EXISTS idx_category_synonyms_standard ON category_synonyms(standard_category);
CREATE INDEX IF NOT EXISTS idx_import_history_user ON csv_import_history(user_id);
CREATE INDEX IF NOT EXISTS idx_import_history_distributor ON csv_import_history(distributor_name);

-- Update trigger for csv_distributor_mappings
CREATE TRIGGER update_csv_distributor_mappings_updated_at 
  BEFORE UPDATE ON csv_distributor_mappings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies

-- Enable RLS
ALTER TABLE csv_distributor_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_synonyms ENABLE ROW LEVEL SECURITY;
ALTER TABLE csv_import_history ENABLE ROW LEVEL SECURITY;

-- Policies for csv_distributor_mappings (admin only for write, all for read)
CREATE POLICY "Anyone can view distributor mappings"
  ON csv_distributor_mappings FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert distributor mappings"
  ON csv_distributor_mappings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update distributor mappings"
  ON csv_distributor_mappings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete distributor mappings"
  ON csv_distributor_mappings FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Policies for category_synonyms (admin only for write, all for read)
CREATE POLICY "Anyone can view category synonyms"
  ON category_synonyms FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage category synonyms"
  ON category_synonyms FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Policies for csv_import_history (users see their own, admins see all)
CREATE POLICY "Users can view their own import history"
  ON csv_import_history FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Users can insert their own import history"
  ON csv_import_history FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Pre-populate common German furniture category synonyms
INSERT INTO category_synonyms (standard_category, synonym, language, confidence) VALUES
  -- German translations
  ('Wardrobes', 'Kleiderschrank', 'de', 0.98),
  ('Wardrobes', 'Kleiderschränke', 'de', 0.98),
  ('Wardrobes', 'Garderobenschrank', 'de', 0.95),
  ('Living Room', 'Wohnzimmer', 'de', 1.00),
  ('Bedroom', 'Schlafzimmer', 'de', 1.00),
  ('Kitchen Cabinets', 'Küchenschrank', 'de', 0.95),
  ('Kitchen Cabinets', 'Küchenschränke', 'de', 0.95),
  ('Kitchen', 'Küche', 'de', 1.00),
  ('Dining Room', 'Esszimmer', 'de', 0.97),
  ('Dining Room', 'Essbereich', 'de', 0.92),
  ('Office', 'Büro', 'de', 1.00),
  ('Office', 'Arbeitszimmer', 'de', 0.95),
  ('Office Desks', 'Schreibtisch', 'de', 0.95),
  ('Office Desks', 'Bürotisch', 'de', 0.95),
  ('Chairs', 'Stühle', 'de', 1.00),
  ('Chairs', 'Stuhl', 'de', 1.00),
  ('Office Chairs', 'Bürostuhl', 'de', 0.98),
  ('Office Chairs', 'Bürostühle', 'de', 0.98),
  ('Sofas', 'Sofa', 'de', 1.00),
  ('Sofas', 'Couch', 'de', 0.98),
  ('Tables', 'Tisch', 'de', 1.00),
  ('Tables', 'Tische', 'de', 1.00),
  ('Coffee Tables', 'Couchtisch', 'de', 0.98),
  ('Coffee Tables', 'Beistelltisch', 'de', 0.90),
  ('Beds', 'Bett', 'de', 1.00),
  ('Beds', 'Betten', 'de', 1.00),
  ('Bookcases', 'Bücherregal', 'de', 0.98),
  ('Bookcases', 'Regal', 'de', 0.85),
  ('Shelves', 'Regal', 'de', 0.90),
  ('Shelves', 'Regale', 'de', 0.90),
  ('Shoe Cabinets', 'Schuhschrank', 'de', 0.98),
  ('TV Stands', 'TV-Schrank', 'de', 0.95),
  ('TV Stands', 'TV-Möbel', 'de', 0.92),
  ('Bathroom', 'Badezimmer', 'de', 1.00),
  ('Bathroom', 'Bad', 'de', 0.95),
  ('Outdoor', 'Außenbereich', 'de', 0.95),
  ('Outdoor', 'Garten', 'de', 0.90),
  ('Garden Furniture', 'Gartenmöbel', 'de', 0.98),
  
  -- Dutch translations
  ('Wardrobes', 'Kledingkast', 'nl', 0.98),
  ('Living Room', 'Woonkamer', 'nl', 1.00),
  ('Bedroom', 'Slaapkamer', 'nl', 1.00),
  ('Kitchen', 'Keuken', 'nl', 1.00),
  ('Dining Room', 'Eetkamer', 'nl', 1.00),
  ('Office', 'Kantoor', 'nl', 1.00),
  ('Chairs', 'Stoelen', 'nl', 1.00),
  ('Sofas', 'Bank', 'nl', 0.95),
  ('Tables', 'Tafels', 'nl', 1.00),
  ('Beds', 'Bedden', 'nl', 1.00),
  
  -- Bulgarian translations
  ('Decoration', 'Декорация', 'bg', 1.00),
  ('Blinds', 'Щори', 'bg', 0.98),
  ('Curtains', 'Завеси', 'bg', 0.98),
  ('Umbrellas', 'Чадъри', 'bg', 0.95),
  ('Garden', 'Градина', 'bg', 1.00),
  ('Outdoor', 'Външни', 'bg', 0.90),
  
  -- Greek translations
  ('Wardrobes', 'Ντουλάπες', 'el', 0.98),
  ('Living Room', 'Σαλόνι', 'el', 1.00),
  ('Bedroom', 'Υπνοδωμάτιο', 'el', 1.00),
  ('Kitchen', 'Κουζίνα', 'el', 1.00),
  ('Office', 'Γραφείο', 'el', 1.00),
  ('Chairs', 'Καρέκλες', 'el', 1.00),
  ('Tables', 'Τραπέζια', 'el', 1.00),
  ('Beds', 'Κρεβάτια', 'el', 1.00),
  ('Storage', 'Αποθήκευση', 'el', 0.95),
  ('Shoe Racks', 'Παπουτσοθήκες', 'el', 0.98)
ON CONFLICT (synonym, distributor) DO NOTHING;

-- Pre-populate Megapap distributor mapping (Greek format)
INSERT INTO csv_distributor_mappings (distributor_name, column_mappings, category_mappings, detection_patterns)
VALUES (
  'Megapap',
  '{
    "id": "ignore",
    "model": "model",
    "sku": "sku",
    "retail_price": "retail_price",
    "weboffer_price": "wholesale_price",
    "name": "name",
    "category": "category",
    "manufacturer": "manufacturer",
    "description": "description",
    "availability": "availability",
    "quantity": "stock",
    "weight": "weight",
    "transportational_weight": "transportational_weight",
    "date_expected": "date_expected",
    "main_image": "main_image",
    "image1": "images[0]",
    "image2": "images[1]",
    "image3": "images[2]",
    "image4": "images[3]",
    "image5": "images[4]",
    "image6": "images[5]",
    "image7": "images[6]",
    "image8": "images[7]",
    "image9": "images[8]",
    "image10": "images[9]"
  }',
  '{}',
  '{
    "required_columns": ["sku", "weboffer_price", "name"],
    "delimiter": ";",
    "manufacturer_hint": "MEGAPAP",
    "url_pattern": "megapap.com"
  }'
)
ON CONFLICT DO NOTHING;

-- Pre-populate B2BMarkt distributor mapping (Bulgarian/Greek format)
INSERT INTO csv_distributor_mappings (distributor_name, column_mappings, category_mappings, detection_patterns)
VALUES (
  'B2BMarkt',
  '{
    "ProductId": "ignore",
    "ProductCode": "model",
    "ItemCode": "sku",
    "Name": "name",
    "ExtendedDescription": "description",
    "ImagesLocation/image/0": "main_image",
    "ImagesLocation/image/1": "images[0]",
    "ImagesLocation/image/2": "images[1]",
    "ImagesLocation/image/3": "images[2]",
    "ImagesLocation/image/4": "images[3]",
    "ImagesLocation/image/5": "images[4]",
    "Stock": "stock",
    "MinQuantity": "moq",
    "ZoneFourUnitPrice": "wholesale_price",
    "RetailCurrentPrice": "retail_price",
    "MarketPrice": "ignore",
    "Weight": "weight",
    "VolumetricWeight": "transportational_weight",
    "Categories/Category/0/__text": "category",
    "Categories/Category/1/__text": "subcategory",
    "AvailabilityTypeName": "availability"
  }',
  '{
    "Декорация": "Decoration",
    "Щори-Завеси-Завесни пръчки-Комарници": "Blinds & Curtains"
  }',
  '{
    "required_columns": ["ProductCode", "Name", "ZoneFourUnitPrice"],
    "delimiter": ",",
    "url_pattern": "b2bmarkt.gr"
  }'
)
ON CONFLICT DO NOTHING;

