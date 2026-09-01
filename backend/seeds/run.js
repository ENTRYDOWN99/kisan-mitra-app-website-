require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function seed() {
    console.log('Seeding KISAN MITRA database...');

    await pool.query(`INSERT INTO users (mobile, role, name, district, state, kyc_status) VALUES
        ('9876543210', 'farmer', 'Rajesh Kumar', 'Nashik', 'Maharashtra', 'Verified'),
        ('9876543211', 'buyer', 'Sharma Trading Co.', 'Mumbai', 'Maharashtra', 'Verified'),
        ('9876543212', 'officer', 'Priya Desai', 'Nashik', 'Maharashtra', 'Verified'),
        ('9876543213', 'fpo', 'Sahyadri Farmers Producer Co.', 'Nashik', 'Maharashtra', 'Verified'),
        ('8765432109', 'farmer', 'Sunita Devi', 'Nashik', 'Maharashtra', 'Verified'),
        ('7654321098', 'farmer', 'Mohan Patil', 'Pune', 'Maharashtra', 'Pending'),
        ('6543210987', 'farmer', 'Kavita Singh', 'Pune', 'Maharashtra', 'Verified'),
        ('5432109876', 'farmer', 'Dinesh Sharma', 'Nashik', 'Maharashtra', 'Rejected')
    ON CONFLICT (mobile) DO NOTHING`);

    await pool.query(`INSERT INTO farmer_profiles (user_id, land_acres, crops)
        SELECT id, 5, ARRAY['Onion','Tomato','Wheat'] FROM users WHERE mobile='9876543210'
        UNION ALL SELECT id, 2, ARRAY['Wheat'] FROM users WHERE mobile='8765432109'
        UNION ALL SELECT id, 8, ARRAY['Onion','Soybean'] FROM users WHERE mobile='7654321098'
        UNION ALL SELECT id, 3, ARRAY['Tomato'] FROM users WHERE mobile='6543210987'
        UNION ALL SELECT id, 10, ARRAY['Cotton','Wheat'] FROM users WHERE mobile='5432109876'
    ON CONFLICT (user_id) DO NOTHING`);

    await pool.query(`INSERT INTO buyer_profiles (user_id, company_name, gst_number, category)
        SELECT id, 'Sharma Trading Co.', '27ABCDE1234F1Z5', 'Wholesaler' FROM users WHERE mobile='9876543211'
    ON CONFLICT (user_id) DO NOTHING`);

    await pool.query(`INSERT INTO fpo_profiles (user_id, reg_number, member_count, nabard_grade)
        SELECT id, 'FPO/NASHIK/2024/001', 8, 'A' FROM users WHERE mobile='9876543213'
    ON CONFLICT (user_id) DO NOTHING`);

    await pool.query(`INSERT INTO mandi_prices (mandi_name, state, commodity, price_quintal, msp_quintal) VALUES
        ('Nashik APMC', 'Maharashtra', 'Onion', 720, 800),
        ('Lasalgaon', 'Maharashtra', 'Onion', 740, 800),
        ('Azadpur Mandi', 'Delhi', 'Tomato', 1240, 600),
        ('Vashi APMC', 'Maharashtra', 'Potato', 1150, 0),
        ('Amritsar', 'Punjab', 'Wheat', 2200, 2275),
        ('Ludhiana', 'Punjab', 'Wheat', 2210, 2275),
        ('Indore', 'Madhya Pradesh', 'Soybean', 4680, 4892),
        ('Guntur', 'Andhra Pradesh', 'Chilli', 8900, 0),
        ('Rajkot', 'Gujarat', 'Groundnut', 6500, 6783),
        ('Jaipur', 'Rajasthan', 'Mustard', 5880, 5950),
        ('Karnal', 'Haryana', 'Paddy (Common)', 2350, 2300),
        ('Nagpur', 'Maharashtra', 'Gram (Chana)', 5720, 5650)
    ON CONFLICT DO NOTHING`);

    await pool.query(`INSERT INTO schemes (name, department, benefit_description, eligible_roles) VALUES
        ('PM-Kisan Samman Nidhi', 'MoA&FW', 'Income support of ₹6,000/year to farmer families in 3 equal instalments.', ARRAY['farmer']),
        ('PM-Fasal Bima Yojana', 'MoA&FW', 'Comprehensive crop insurance covering pre-sowing to post-harvest losses.', ARRAY['farmer']),
        ('PM-Krishi Sinchayee Yojana', 'MoA&FW', 'Micro-irrigation subsidy up to 55% for efficient water use.', ARRAY['farmer']),
        ('NABARD FPO Equity Grant', 'NABARD', 'Equity grant up to ₹15 lakhs for registered FPOs.', ARRAY['fpo']),
        ('FPO Common Branding Support', 'MoA&FW', 'Financial support for FPO branding, packaging, and marketing.', ARRAY['fpo']),
        ('Cold Chain & Logistics Subsidy', 'MoA&FW', 'Subsidy for cold storage and logistics infrastructure for FPOs.', ARRAY['fpo']),
        ('Soil Health Card Scheme', 'MoA&FW', 'Free soil testing and nutrient recommendations for farmers.', ARRAY['farmer']),
        ('PM-Kisan Maan Dhan Yojana', 'MoA&FW', 'Pension scheme for small and marginal farmers aged 18-40.', ARRAY['farmer'])
    ON CONFLICT DO NOTHING`);

    console.log('✓ Seed data inserted');
    await pool.end();
}

seed().catch(err => { console.error(err); process.exit(1); });
