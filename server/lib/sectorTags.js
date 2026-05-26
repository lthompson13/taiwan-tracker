/**
 * Sector tagging for Taiwan legislative bills.
 *
 * Rules are matched against raw Chinese field values (billName, proposer)
 * BEFORE translation. A bill may match multiple sectors.
 *
 * Two matching strategies per rule:
 *   keywords   — substring match against billName + proposer
 *   committees — substring match against proposer only (committee bills
 *                often have generic titles but a specific proposing committee)
 */

const SECTOR_RULES = [
  {
    sector: 'Semiconductors',
    keywords: ['半導體', '晶片', '積體電路', '晶圓', '電子零組件', 'IC設計'],
  },
  {
    sector: 'Defense',
    keywords: ['國防', '軍事', '兵役', '後備', '國軍', '軍備', '軍人', '武器', '彈藥', '空軍', '海軍', '陸軍', '憲兵', '兵工'],
    committees: ['外交及國防'],
  },
  {
    sector: 'Energy',
    keywords: ['能源', '電力', '再生能源', '核電', '核能', '天然氣', '石油', '太陽能', '風電', '風力', '電業'],
  },
  {
    sector: 'Financial Regulation',
    keywords: ['金融', '銀行', '保險', '證券', '期貨', '投資信託', '外匯', '洗錢', '票券', '金管', '信用合作', '信用卡'],
    committees: ['財政'],
  },
  {
    sector: 'Healthcare',
    keywords: ['醫療', '衛生', '健保', '藥品', '醫師', '護理', '醫院', '藥事', '長照', '精神衛生', '食品安全', '醫藥'],
    committees: ['衛生環境'],
  },
  {
    sector: 'Trade',
    keywords: ['貿易', '關稅', '進出口', '自由貿易', 'ECFA', '商品檢驗', '傾銷', '反傾銷', '原產地'],
    committees: ['經濟'],
  },
  {
    sector: 'Cross-Strait',
    keywords: ['兩岸', '大陸地區', '台商', '香港澳門', '港澳'],
  },
  {
    sector: 'Foreign Investment',
    keywords: ['外資', '外國人投資', '外國投資', '投資促進', '技術合作', '外國專業人員'],
  },
  {
    sector: 'Data & Technology',
    keywords: ['個人資料', '個資', '資訊安全', '資安', '網路安全', '數位', '人工智慧', '電信', '通訊傳播', '資通安全'],
    committees: ['科技'],
  },
  {
    sector: 'Labor',
    keywords: ['勞工', '勞動', '工時', '職業安全', '就業', '勞保', '工會', '薪資', '退休金', '職場'],
    committees: ['勞動'],
  },
  {
    sector: 'Environment',
    keywords: ['環境', '環保', '空氣污染', '水污染', '廢棄物', '溫室氣體', '碳排', '氣候', '自然保育', '污染防制', '生態保育'],
    committees: ['衛生環境'],
  },
  {
    sector: 'Agriculture',
    keywords: ['農業', '農產', '糧食', '漁業', '畜牧', '農民', '農田', '水利', '農藥', '林業', '農村'],
    committees: ['農業'],
  },
  {
    sector: 'Transportation',
    keywords: ['交通', '運輸', '鐵路', '捷運', '航空', '公路', '港埠', '高速公路', '道路', '航運', '橋梁'],
    committees: ['交通'],
  },
];

/**
 * Return the list of matching sector labels for a bill.
 * Must be called BEFORE translateBill() so field values are still Chinese.
 *
 * @param {object} bill - Bill object after mapBill() (English keys, Chinese values)
 * @returns {string[]} Sector labels, e.g. ['Defense', 'Trade']. Empty if none match.
 */
function tagBill(bill) {
  const billName = bill.billName || '';
  const proposer = bill.proposer || '';
  const fullText = billName + ' ' + proposer;

  const tags = new Set();

  for (const rule of SECTOR_RULES) {
    // Keyword match against full text
    if (rule.keywords) {
      for (const kw of rule.keywords) {
        if (fullText.includes(kw)) {
          tags.add(rule.sector);
          break;
        }
      }
    }

    // Committee match against proposer only
    if (rule.committees) {
      for (const committee of rule.committees) {
        if (proposer.includes(committee)) {
          tags.add(rule.sector);
          break;
        }
      }
    }
  }

  return [...tags];
}

module.exports = { tagBill, SECTOR_RULES };
