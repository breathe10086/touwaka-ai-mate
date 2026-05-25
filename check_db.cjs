const { Sequelize } = require('sequelize');

async function main() {
  const s = new Sequelize('touwaka_mate', 'touwaka', '123456', {
    host: 'localhost',
    port: 3306,
    dialect: 'mysql',
    logging: false
  });

  try {
    // Get a valid user ID from existing apps
    const users = await s.query("SELECT id FROM users LIMIT 1", {
      type: s.QueryTypes.SELECT
    });
    
    if (users.length === 0) {
      console.error('No users found in database!');
      process.exit(1);
    }
    
    const userId = users[0].id;
    console.log('Using user ID:', userId);

    // Check if ocr-tool exists in mini_apps
    const existing = await s.query("SELECT * FROM mini_apps WHERE id='ocr-tool'", {
      type: s.QueryTypes.SELECT
    });
    
    if (existing.length === 0) {
      // Insert ocr-tool into mini_apps
      await s.query(`
        INSERT INTO mini_apps (id, name, description, icon, type, component, fields, views, config, visibility, owner_id, creator_id, sort_order, is_active, revision, created_at, updated_at)
        VALUES (
          'ocr-tool',
          'OCR 文字识别工具',
          '上传图片，使用多模态模型识别文字内容，不保存原图。',
          '📝',
          'utility',
          'OcrToolView',
          '[]',
          '{}',
          '{"extension_tables":[]}',
          'all',
          ?,
          ?,
          0,
          1,
          1,
          NOW(),
          NOW()
        )
      `, { 
        type: s.QueryTypes.INSERT,
        replacements: [userId, userId]
      });
      console.log('✅ Added ocr-tool to mini_apps');
    } else {
      console.log('ocr-tool already exists in mini_apps');
    }

    // Check if ocr-tool exists in app_clock_registry
    const existingRegistry = await s.query("SELECT * FROM app_clock_registry WHERE app_id='ocr-tool'", {
      type: s.QueryTypes.SELECT
    });
    
    if (existingRegistry.length === 0) {
      // Insert ocr-tool into app_clock_registry
      await s.query(`
        INSERT INTO app_clock_registry (id, app_id, tick_script, is_active, created_at)
        VALUES (
          'ocr-tool-registry',
          'ocr-tool',
          NULL,
          1,
          NOW()
        )
      `, { type: s.QueryTypes.INSERT });
      console.log('✅ Added ocr-tool to app_clock_registry');
    } else {
      console.log('ocr-tool already exists in app_clock_registry');
    }

    console.log('✅ OCR tool registration complete!');
  } finally {
    await s.close();
  }
}

main().catch(console.error);