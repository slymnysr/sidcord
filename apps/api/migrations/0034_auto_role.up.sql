-- Otomatik rol: yeni katılan üyelere atanacak rol
ALTER TABLE guilds ADD COLUMN IF NOT EXISTS auto_role_id BIGINT REFERENCES roles(id) ON DELETE SET NULL;
