import { useState, useEffect, useRef, useCallback, createContext, useContext } from "react";

// ─── Font injection ──────────────────────────────────────────────────────────
const FONT_LINK = "https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,500;0,9..40,700;0,9..40,900;1,9..40,400&family=Instrument+Serif:ital@0;1&display=swap";
if(typeof document!=="undefined"&&!document.getElementById("munro-fonts")){
  const l=document.createElement("link");l.id="munro-fonts";l.rel="stylesheet";l.href=FONT_LINK;document.head.appendChild(l);
  const s=document.createElement("style");s.textContent=`
    @keyframes pulse{0%,100%{opacity:.3}50%{opacity:.75}}
    @keyframes fogDrift{0%{transform:translateX(-30%)}100%{transform:translateX(30%)}}
    @keyframes fogDrift2{0%{transform:translateX(20%)}100%{transform:translateX(-25%)}}
    @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
    ::-webkit-scrollbar{width:4px;height:4px}
    ::-webkit-scrollbar-track{background:transparent}
    ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:2px}
  `;document.head.appendChild(s);
}
const FF = "'DM Sans',system-ui,sans-serif";
const FFS = "'DM Sans',system-ui,sans-serif"; // munro names: bold all-caps system font

// ─── All 282 Scottish Munros ─────────────────────────────────────────────────
const MUNROS_RAW = [
  {n:"Ben Nevis",h:1345,lat:56.7967,lon:-5.0042,r:"Lochaber"},
  {n:"Ben Macdui",h:1309,lat:57.0706,lon:-3.67,r:"Cairngorms"},
  {n:"Braeriach",h:1296,lat:57.0788,lon:-3.7281,r:"Cairngorms"},
  {n:"Cairn Toul",h:1291,lat:57.0547,lon:-3.7105,r:"Cairngorms"},
  {n:"Sgor an Lochain Uaine",h:1258,lat:57.0581,lon:-3.7255,r:"Cairngorms"},
  {n:"Cairn Gorm",h:1245,lat:57.1167,lon:-3.644,r:"Cairngorms"},
  {n:"Aonach Beag",h:1234,lat:56.8006,lon:-4.9537,r:"Lochaber"},
  {n:"Aonach Mor",h:1221,lat:56.813,lon:-4.9612,r:"Lochaber"},
  {n:"Carn Mor Dearg",h:1220,lat:56.8052,lon:-4.9868,r:"Lochaber"},
  {n:"Ben Lawers",h:1214,lat:56.5452,lon:-4.2211,r:"Breadalbane"},
  {n:"Beinn a' Bhuird",h:1196,lat:57.088,lon:-3.4991,r:"Cairngorms"},
  {n:"Beinn Mheadhoin",h:1183,lat:57.0956,lon:-3.6117,r:"Cairngorms"},
  {n:"Carn Eighe",h:1183,lat:57.2875,lon:-5.1155,r:"Glen Affric"},
  {n:"Mam Sodhail",h:1181,lat:57.2802,lon:-5.1198,r:"Glen Affric"},
  {n:"Stob Choire Claurigh",h:1177,lat:56.8236,lon:-4.8506,r:"Lochaber"},
  {n:"Ben More",h:1174,lat:56.3863,lon:-4.5407,r:"Breadalbane"},
  {n:"Ben Avon",h:1171,lat:57.0995,lon:-3.4352,r:"Cairngorms"},
  {n:"Stob Binnein",h:1165,lat:56.3711,lon:-4.5365,r:"Breadalbane"},
  {n:"Beinn Bhrotain",h:1157,lat:57.0096,lon:-3.7233,r:"Cairngorms"},
  {n:"Derry Cairngorm",h:1156,lat:57.0631,lon:-3.6218,r:"Cairngorms"},
  {n:"Lochnagar",h:1155,lat:56.9605,lon:-3.2457,r:"Cairngorms"},
  {n:"Sgurr na Lapaich",h:1150,lat:57.3698,lon:-5.0592,r:"Glen Affric"},
  {n:"Sgurr nan Ceathreamhnan",h:1150,lat:57.2551,lon:-5.2222,r:"Kintail"},
  {n:"Bidean nam Bian",h:1150,lat:56.6432,lon:-5.0295,r:"Glen Coe"},
  {n:"Ben Alder",h:1148,lat:56.8139,lon:-4.4647,r:"Badenoch"},
  {n:"Ben Lui",h:1130,lat:56.3967,lon:-4.8105,r:"Breadalbane"},
  {n:"Geal-Charn",h:1132,lat:56.8381,lon:-4.5106,r:"Badenoch"},
  {n:"Binnein Mor",h:1130,lat:56.7545,lon:-4.9255,r:"Lochaber"},
  {n:"An Riabhachan",h:1129,lat:57.3623,lon:-5.1052,r:"Glen Affric"},
  {n:"Creag Meagaidh",h:1130,lat:56.9522,lon:-4.6022,r:"Lochaber"},
  {n:"Ben Cruachan",h:1126,lat:56.4267,lon:-5.1323,r:"Argyll"},
  {n:"Meall Garbh",h:1118,lat:56.5662,lon:-4.2077,r:"Breadalbane"},
  {n:"Carn nan Gabhar",h:1121,lat:56.8403,lon:-3.6876,r:"Atholl"},
  {n:"A' Chralaig",h:1120,lat:57.184,lon:-5.1548,r:"Kintail"},
  {n:"An Stuc",h:1118,lat:56.5606,lon:-4.2171,r:"Breadalbane"},
  {n:"Stob Coire an Laoigh",h:1116,lat:56.8112,lon:-4.8857,r:"Lochaber"},
  {n:"Sgor Gaoith",h:1118,lat:57.0686,lon:-3.8101,r:"Cairngorms"},
  {n:"Aonach Beag (Badenoch)",h:1116,lat:56.8333,lon:-4.53,r:"Badenoch"},
  {n:"Stob Coire Easain",h:1115,lat:56.8182,lon:-4.7732,r:"Lochaber"},
  {n:"Monadh Mor",h:1113,lat:57.0272,lon:-3.7504,r:"Cairngorms"},
  {n:"Tom a' Choinich",h:1112,lat:57.2999,lon:-5.0484,r:"Glen Affric"},
  {n:"Carn a' Choire Bhoidheach",h:1110,lat:56.9458,lon:-3.2731,r:"Cairngorms"},
  {n:"Sgurr nan Conbhairean",h:1109,lat:57.1774,lon:-5.0963,r:"Kintail"},
  {n:"Sgurr Mor",h:1110,lat:57.7007,lon:-5.0166,r:"Ross-shire"},
  {n:"Meall a' Bhuiridh",h:1108,lat:56.6124,lon:-4.8526,r:"Glen Coe"},
  {n:"Stob a' Choire Mheadhoin",h:1105,lat:56.8239,lon:-4.7605,r:"Lochaber"},
  {n:"Beinn Ghlas",h:1103,lat:56.536,lon:-4.2368,r:"Breadalbane"},
  {n:"Beinn Eibhinn",h:1102,lat:56.8258,lon:-4.5426,r:"Badenoch"},
  {n:"Mullach Fraoch-choire",h:1102,lat:57.2055,lon:-5.1566,r:"Kintail"},
  {n:"Creise",h:1100,lat:56.6146,lon:-4.8723,r:"Glen Coe"},
  {n:"Sgurr a' Mhaim",h:1099,lat:56.7562,lon:-5.0042,r:"Lochaber"},
  {n:"Sgurr Choinnich Mor",h:1094,lat:56.8008,lon:-4.9046,r:"Lochaber"},
  {n:"Sgurr nan Clach Geala",h:1093,lat:57.6963,lon:-5.0481,r:"Ross-shire"},
  {n:"Bynack More",h:1090,lat:57.1382,lon:-3.5855,r:"Cairngorms"},
  {n:"Stob Ghabhar",h:1090,lat:56.5685,lon:-4.8819,r:"Argyll"},
  {n:"Beinn a' Chlachair",h:1088,lat:56.8696,lon:-4.5094,r:"Badenoch"},
  {n:"Beinn Dearg",h:1084,lat:57.7863,lon:-4.9295,r:"Ross-shire"},
  {n:"Sgurr a' Choire Ghlais",h:1083,lat:57.4444,lon:-4.9037,r:"Ross-shire"},
  {n:"Schiehallion",h:1083,lat:56.6669,lon:-4.1009,r:"Breadalbane"},
  {n:"Beinn a' Chaorainn",h:1083,lat:57.0933,lon:-3.5769,r:"Cairngorms"},
  {n:"Beinn a' Chreachain",h:1081,lat:56.5602,lon:-4.6484,r:"Breadalbane"},
  {n:"Ben Starav",h:1078,lat:56.5393,lon:-5.0505,r:"Argyll"},
  {n:"Beinn Heasgarnich",h:1078,lat:56.5104,lon:-4.5799,r:"Breadalbane"},
  {n:"Beinn Dorain",h:1076,lat:56.5029,lon:-4.7225,r:"Breadalbane"},
  {n:"Stob Coire Sgreamhach",h:1072,lat:56.6383,lon:-5.0112,r:"Glen Coe"},
  {n:"Braigh Coire Chruinn-bhalgain",h:1070,lat:56.8316,lon:-3.7298,r:"Atholl"},
  {n:"An Socach",h:1069,lat:57.3502,lon:-5.159,r:"Glen Affric"},
  {n:"Sgurr Fhuaran",h:1067,lat:57.1961,lon:-5.3479,r:"Kintail"},
  {n:"Glas Maol",h:1068,lat:56.8729,lon:-3.3691,r:"Cairngorms"},
  {n:"Meall Corranaich",h:1069,lat:56.5411,lon:-4.2534,r:"Breadalbane"},
  {n:"Cairn of Claise",h:1064,lat:56.8939,lon:-3.3387,r:"Cairngorms"},
  {n:"Bidein a' Ghlas Thuill",h:1062,lat:57.8072,lon:-5.2528,r:"Ross-shire"},
  {n:"Sgurr Fiona",h:1060,lat:57.8007,lon:-5.259,r:"Ross-shire"},
  {n:"Spidean a' Choire Leith",h:1055,lat:57.5643,lon:-5.4636,r:"Torridon"},
  {n:"Na Gruagaichean",h:1056,lat:56.7443,lon:-4.9395,r:"Lochaber"},
  {n:"Toll Creagach",h:1054,lat:57.3092,lon:-4.9994,r:"Glen Affric"},
  {n:"Sgurr a' Chaorachain",h:1053,lat:57.4528,lon:-5.1896,r:"Ross-shire"},
  {n:"Stob Poite Coire Ardair",h:1053,lat:56.9642,lon:-4.5865,r:"Lochaber"},
  {n:"Glas Tulaichean",h:1051,lat:56.8662,lon:-3.5575,r:"Cairngorms"},
  {n:"Geal Charn",h:1049,lat:56.8976,lon:-4.4571,r:"Badenoch"},
  {n:"Sgurr Fhuar-thuill",h:1049,lat:57.4498,lon:-4.9425,r:"Ross-shire"},
  {n:"Beinn a' Chaorainn (Laggan)",h:1049,lat:56.9287,lon:-4.6531,r:"Lochaber"},
  {n:"Carn an t-Sagairt Mor",h:1047,lat:56.9428,lon:-3.3026,r:"Cairngorms"},
  {n:"Creag Mhor",h:1047,lat:56.49,lon:-4.6143,r:"Breadalbane"},
  {n:"Ben Wyvis",h:1046,lat:57.6789,lon:-4.5802,r:"Ross-shire"},
  {n:"Chno Dearg",h:1046,lat:56.8305,lon:-4.6609,r:"Lochaber"},
  {n:"Cruach Ardrain",h:1046,lat:56.3568,lon:-4.576,r:"Breadalbane"},
  {n:"Beinn Iutharn Mhor",h:1045,lat:56.8949,lon:-3.5686,r:"Cairngorms"},
  {n:"Stob Coir' an Albannaich",h:1044,lat:56.5554,lon:-4.9802,r:"Argyll"},
  {n:"Meall nan Tarmachan",h:1044,lat:56.5213,lon:-4.301,r:"Breadalbane"},
  {n:"Carn Mairg",h:1042,lat:56.6346,lon:-4.1464,r:"Breadalbane"},
  {n:"Sgurr na Ciche",h:1040,lat:57.0133,lon:-5.4567,r:"Knoydart"},
  {n:"Meall Ghaordaidh",h:1039,lat:56.5263,lon:-4.4168,r:"Breadalbane"},
  {n:"Carn a' Mhaim",h:1037,lat:57.0366,lon:-3.6586,r:"Cairngorms"},
  {n:"Beinn Achaladair",h:1038,lat:56.552,lon:-4.6951,r:"Breadalbane"},
  {n:"Sgurr a' Bhealaich Dheirg",h:1036,lat:57.1779,lon:-5.2519,r:"Kintail"},
  {n:"Gleouraich",h:1035,lat:57.0974,lon:-5.2382,r:"Knoydart"},
  {n:"Carn Dearg",h:1034,lat:56.8554,lon:-4.4543,r:"Badenoch"},
  {n:"Beinn Fhada",h:1032,lat:57.2212,lon:-5.2839,r:"Kintail"},
  {n:"Am Bodach",h:1032,lat:56.7414,lon:-4.9834,r:"Lochaber"},
  {n:"Ben Oss",h:1029,lat:56.3894,lon:-4.7759,r:"Breadalbane"},
  {n:"Carn Gorm",h:1029,lat:56.6225,lon:-4.2256,r:"Breadalbane"},
  {n:"Carn an Righ",h:1029,lat:56.8765,lon:-3.5957,r:"Cairngorms"},
  {n:"Sgurr na Ciste Duibhe",h:1027,lat:57.1811,lon:-5.3366,r:"Kintail"},
  {n:"Sgurr a' Mhaoraich",h:1027,lat:57.1058,lon:-5.3298,r:"Knoydart"},
  {n:"Beinn Challum",h:1025,lat:56.4548,lon:-4.62,r:"Breadalbane"},
  {n:"Sgorr Dhearg",h:1024,lat:56.6541,lon:-5.1724,r:"Lochaber"},
  {n:"Mullach an Rathain",h:1023,lat:57.5607,lon:-5.4934,r:"Torridon"},
  {n:"Buachaille Etive Mor",h:1022,lat:56.6463,lon:-4.9008,r:"Glen Coe"},
  {n:"Ladhar Bheinn",h:1020,lat:57.0752,lon:-5.5912,r:"Knoydart"},
  {n:"Carn Dearg (Ben Nevis)",h:1020,lat:56.755,lon:-5.0189,r:"Lochaber"},
  {n:"Aonach air Chrith",h:1021,lat:57.1248,lon:-5.2208,r:"Kintail"},
  {n:"Beinn Bheoil",h:1019,lat:56.8137,lon:-4.4303,r:"Badenoch"},
  {n:"Mullach Clach a' Bhlair",h:1019,lat:57.0124,lon:-3.842,r:"Cairngorms"},
  {n:"Carn an Tuirc",h:1019,lat:56.9081,lon:-3.3572,r:"Cairngorms"},
  {n:"Mullach Coire Mhic Fhearchair",h:1019,lat:57.7096,lon:-5.2709,r:"Ross-shire"},
  {n:"Garbh Chioch Mhor",h:1013,lat:57.0092,lon:-5.4448,r:"Knoydart"},
  {n:"Beinn Ime",h:1011,lat:56.2365,lon:-4.8181,r:"Arrochar Alps"},
  {n:"The Saddle",h:1010,lat:57.1628,lon:-5.4144,r:"Kintail"},
  {n:"Cairn Bannoch",h:1012,lat:56.9278,lon:-3.2791,r:"Cairngorms"},
  {n:"Beinn Udlamain",h:1010,lat:56.8353,lon:-4.3301,r:"Atholl"},
  {n:"Ruadh-stac Mor",h:1010,lat:57.594,lon:-5.4296,r:"Torridon"},
  {n:"Sgurr Eilde Mor",h:1010,lat:56.7498,lon:-4.8957,r:"Lochaber"},
  {n:"Sgurr an Doire Leathain",h:1010,lat:57.1367,lon:-5.2814,r:"Kintail"},
  {n:"Beinn Dearg (Atholl)",h:1008,lat:56.8779,lon:-3.8846,r:"Atholl"},
  {n:"The Devil's Point",h:1004,lat:57.0362,lon:-3.6882,r:"Cairngorms"},
  {n:"An Sgarsoch",h:1006,lat:56.9319,lon:-3.7542,r:"Cairngorms"},
  {n:"Carn Liath",h:1006,lat:56.9792,lon:-4.5152,r:"Lochaber"},
  {n:"Maoile Lunndaidh",h:1007,lat:57.4647,lon:-5.1105,r:"Ross-shire"},
  {n:"Beinn Fhionnlaidh",h:1005,lat:57.306,lon:-5.1303,r:"Glen Affric"},
  {n:"Sgurr an Lochain",h:1004,lat:57.1417,lon:-5.2983,r:"Kintail"},
  {n:"Sgurr Mor (Knoydart)",h:1003,lat:57.0287,lon:-5.3543,r:"Knoydart"},
  {n:"Beinn an Dothaidh",h:1002,lat:56.53,lon:-4.7146,r:"Breadalbane"},
  {n:"Sgorr Dhonuill",h:1001,lat:56.6507,lon:-5.1982,r:"Lochaber"},
  {n:"Sgurr na Carnach",h:1002,lat:57.1889,lon:-5.3489,r:"Kintail"},
  {n:"Aonach Meadhoin",h:1001,lat:57.1731,lon:-5.23,r:"Kintail"},
  {n:"Meall Greigh",h:1001,lat:56.5679,lon:-4.1589,r:"Breadalbane"},
  {n:"Stob Ban",h:999,lat:56.7439,lon:-5.0311,r:"Lochaber"},
  {n:"Sgurr Breac",h:999,lat:57.6926,lon:-5.0914,r:"Ross-shire"},
  {n:"Sgurr Choinnich",h:999,lat:57.4515,lon:-5.2078,r:"Ross-shire"},
  {n:"Stob Diamh",h:998,lat:56.4313,lon:-5.0921,r:"Argyll"},
  {n:"Sail Chaorainn",h:1002,lat:57.1919,lon:-5.0909,r:"Kintail"},
  {n:"Ben More Assynt",h:998,lat:58.1385,lon:-4.8581,r:"Sutherland"},
  {n:"A' Chailleach",h:997,lat:57.6944,lon:-5.1285,r:"Ross-shire"},
  {n:"Glas Bheinn Mhor",h:997,lat:56.5422,lon:-5.0052,r:"Argyll"},
  {n:"Broad Cairn",h:998,lat:56.9191,lon:-3.2492,r:"Cairngorms"},
  {n:"An Caisteal",h:995,lat:56.3387,lon:-4.625,r:"Breadalbane"},
  {n:"Spidean Mialach",h:996,lat:57.0895,lon:-5.1946,r:"Knoydart"},
  {n:"Sgurr na h-Ulaidh",h:994,lat:56.6195,lon:-5.0798,r:"Glen Coe"},
  {n:"Carn an Fhidhleir",h:994,lat:56.9357,lon:-3.8021,r:"Cairngorms"},
  {n:"Sgurr na Ruaidhe",h:993,lat:57.442,lon:-4.8519,r:"Ross-shire"},
  {n:"Spidean Coire nan Clach",h:993,lat:57.5821,lon:-5.4034,r:"Torridon"},
  {n:"Carn nan Gobhar",h:992,lat:57.3634,lon:-5.0254,r:"Glen Affric"},
  {n:"Sgurr Alasdair",h:992,lat:57.2065,lon:-6.2237,r:"Skye"},
  {n:"Carn nan Gobhar (Strathfarrar)",h:992,lat:57.4522,lon:-4.8794,r:"Ross-shire"},
  {n:"Sgairneach Mhor",h:991,lat:56.8287,lon:-4.2985,r:"Atholl"},
  {n:"Beinn Eunaich",h:989,lat:56.45,lon:-5.0271,r:"Argyll"},
  {n:"Sgurr Ban",h:989,lat:57.7187,lon:-5.2667,r:"Ross-shire"},
  {n:"Creag Leacach",h:987,lat:56.8548,lon:-3.3881,r:"Cairngorms"},
  {n:"Conival",h:987,lat:58.1361,lon:-4.8834,r:"Sutherland"},
  {n:"Lurg Mhor",h:986,lat:57.4133,lon:-5.2244,r:"Ross-shire"},
  {n:"Sgurr Mhor",h:986,lat:57.5909,lon:-5.5733,r:"Torridon"},
  {n:"Sgurr Dearg",h:986,lat:57.2134,lon:-6.2345,r:"Skye"},
  {n:"Ben Vorlich",h:985,lat:56.3431,lon:-4.219,r:"Perthshire"},
  {n:"Druim Shionnach",h:987,lat:57.1267,lon:-5.1829,r:"Kintail"},
  {n:"Gulvain",h:987,lat:56.9361,lon:-5.2851,r:"Lochaber"},
  {n:"Meall nan Aighean",h:981,lat:56.6205,lon:-4.1293,r:"Breadalbane"},
  {n:"Mullach na Dheiragain",h:982,lat:57.2839,lon:-5.1866,r:"Glen Affric"},
  {n:"An Gearanach",h:982,lat:56.7589,lon:-4.9668,r:"Lochaber"},
  {n:"Stob Coire a' Chairn",h:981,lat:56.7508,lon:-4.9694,r:"Lochaber"},
  {n:"Slioch",h:981,lat:57.6672,lon:-5.3476,r:"Ross-shire"},
  {n:"Ciste Dhubh",h:979,lat:57.1997,lon:-5.2091,r:"Kintail"},
  {n:"Maol Chinn-dearg",h:981,lat:57.1276,lon:-5.2524,r:"Kintail"},
  {n:"Beinn a' Chochuill",h:980,lat:56.4499,lon:-5.0693,r:"Argyll"},
  {n:"Stob Coire Sgriodain",h:979,lat:56.8316,lon:-4.6954,r:"Lochaber"},
  {n:"Beinn Dubhchraig",h:978,lat:56.391,lon:-4.7436,r:"Breadalbane"},
  {n:"Cona' Mheall",h:978,lat:57.7914,lon:-4.903,r:"Ross-shire"},
  {n:"Stob Ban (Grey Corries)",h:977,lat:56.8104,lon:-4.8414,r:"Lochaber"},
  {n:"Meall nan Ceapraichean",h:977,lat:57.7988,lon:-4.9339,r:"Ross-shire"},
  {n:"Carn a' Gheoidh",h:975,lat:56.8736,lon:-3.4659,r:"Cairngorms"},
  {n:"Carn Liath (Beinn a' Ghlo)",h:975,lat:56.8081,lon:-3.7435,r:"Atholl"},
  {n:"Beinn Sgritheall",h:974,lat:57.1537,lon:-5.5806,r:"Knoydart"},
  {n:"Ben Lomond",h:974,lat:56.1902,lon:-4.6326,r:"Loch Lomond"},
  {n:"A' Mharconaich",h:975,lat:56.8568,lon:-4.2904,r:"Atholl"},
  {n:"Stuc a' Chroin",h:975,lat:56.3292,lon:-4.2377,r:"Perthshire"},
  {n:"Sgurr a' Ghreadaidh",h:973,lat:57.2277,lon:-6.2345,r:"Skye"},
  {n:"Sgorr nam Fiannaidh",h:967,lat:56.6799,lon:-5.0373,r:"Glen Coe"},
  {n:"Meall Garbh (Glen Lyon)",h:968,lat:56.6372,lon:-4.2069,r:"Breadalbane"},
  {n:"Sgurr nan Gillean",h:964,lat:57.2489,lon:-6.1937,r:"Skye"},
  {n:"Ben More (Mull)",h:966,lat:56.4247,lon:-6.0148,r:"Mull"},
  {n:"A' Mhaighdean",h:967,lat:57.7202,lon:-5.3475,r:"Ross-shire"},
  {n:"Sgurr na Banachdaich",h:965,lat:57.2212,lon:-6.242,r:"Skye"},
  {n:"Carn a' Chlamain",h:963,lat:56.8615,lon:-3.7804,r:"Atholl"},
  {n:"Sgurr Thuilm",h:963,lat:56.937,lon:-5.3888,r:"Lochaber"},
  {n:"Ben Klibreck",h:962,lat:58.2358,lon:-4.411,r:"Sutherland"},
  {n:"Sgorr Ruadh",h:960,lat:57.4993,lon:-5.4074,r:"Torridon"},
  {n:"Stuchd an Lochain",h:960,lat:56.5711,lon:-4.4701,r:"Breadalbane"},
  {n:"Meall Glas",h:959,lat:56.4554,lon:-4.547,r:"Breadalbane"},
  {n:"Beinn nan Aighenan",h:960,lat:56.5205,lon:-5.0116,r:"Argyll"},
  {n:"Beinn Fhionnlaidh (Appin)",h:959,lat:56.6009,lon:-5.1043,r:"Argyll"},
  {n:"Bruach na Frithe",h:958,lat:57.2474,lon:-6.2118,r:"Skye"},
  {n:"Tolmount",h:958,lat:56.9052,lon:-3.298,r:"Cairngorms"},
  {n:"Tom Buidhe",h:957,lat:56.8935,lon:-3.2927,r:"Cairngorms"},
  {n:"Stob Dubh",h:958,lat:56.6384,lon:-4.9704,r:"Glen Coe"},
  {n:"Sgurr nan Coireachan",h:956,lat:56.9362,lon:-5.4496,r:"Lochaber"},
  {n:"Carn Ghluasaid",h:957,lat:57.1664,lon:-5.0689,r:"Kintail"},
  {n:"Saileag",h:956,lat:57.1816,lon:-5.282,r:"Kintail"},
  {n:"Sgor Gaibhre",h:955,lat:56.7727,lon:-4.5472,r:"Badenoch"},
  {n:"Beinn Liath Mhor Fannaich",h:954,lat:57.7067,lon:-4.9902,r:"Ross-shire"},
  {n:"Sgurr nan Coireachan (Knoydart)",h:953,lat:57.0075,lon:-5.4051,r:"Knoydart"},
  {n:"Stob na Broige",h:953,lat:56.6298,lon:-4.9518,r:"Glen Coe"},
  {n:"Am Faochagach",h:954,lat:57.7719,lon:-4.8543,r:"Ross-shire"},
  {n:"Beinn Mhanach",h:953,lat:56.5342,lon:-4.6466,r:"Breadalbane"},
  {n:"Meall Dearg",h:953,lat:56.6807,lon:-5.0031,r:"Glen Coe"},
  {n:"Meall Chuaich",h:951,lat:56.9641,lon:-4.1127,r:"Badenoch"},
  {n:"Meall Gorm",h:949,lat:57.6808,lon:-4.9847,r:"Ross-shire"},
  {n:"Beinn Bhuidhe",h:948,lat:56.327,lon:-4.9073,r:"Argyll"},
  {n:"Sgurr Mhic Choinnich",h:948,lat:57.2092,lon:-6.224,r:"Skye"},
  {n:"Driesh",h:947,lat:56.8478,lon:-3.196,r:"Cairngorms"},
  {n:"Creag a' Mhaim",h:947,lat:57.1209,lon:-5.161,r:"Kintail"},
  {n:"Sgurr na Sgine",h:946,lat:57.1471,lon:-5.3964,r:"Kintail"},
  {n:"Beinn Tulaichean",h:946,lat:56.3427,lon:-4.5637,r:"Breadalbane"},
  {n:"Carn Dearg (Monadhliath)",h:945,lat:57.092,lon:-4.2537,r:"Monadhliath"},
  {n:"Meall Buidhe",h:946,lat:57.0315,lon:-5.5474,r:"Knoydart"},
  {n:"Carn Bhac",h:946,lat:56.9309,lon:-3.5602,r:"Cairngorms"},
  {n:"Stob a' Choire Odhair",h:945,lat:56.5731,lon:-4.8382,r:"Argyll"},
  {n:"Bidein a' Choire Sheasgaich",h:945,lat:57.4198,lon:-5.25,r:"Ross-shire"},
  {n:"Sgurr Dubh Mor",h:944,lat:57.2051,lon:-6.212,r:"Skye"},
  {n:"An Socach (Glen Ey)",h:944,lat:56.9018,lon:-3.513,r:"Cairngorms"},
  {n:"Ben Vorlich (Loch Lomond)",h:943,lat:56.2739,lon:-4.7546,r:"Arrochar Alps"},
  {n:"Binnein Beag",h:943,lat:56.7674,lon:-4.9118,r:"Lochaber"},
  {n:"Beinn a' Chroin",h:942,lat:56.333,lon:-4.5987,r:"Breadalbane"},
  {n:"Carn na Caim",h:941,lat:56.9128,lon:-4.1739,r:"Badenoch"},
  {n:"Carn Dearg (Loch Ossian)",h:941,lat:56.7601,lon:-4.5889,r:"Lochaber"},
  {n:"Mullach nan Coirean",h:939,lat:56.7501,lon:-5.0725,r:"Lochaber"},
  {n:"Beinn na Lap",h:937,lat:56.7892,lon:-4.6596,r:"Lochaber"},
  {n:"Luinne Bheinn",h:939,lat:57.0485,lon:-5.5161,r:"Knoydart"},
  {n:"Mount Keen",h:939,lat:56.9701,lon:-2.9729,r:"Cairngorms"},
  {n:"Sron a' Choire Ghairbh",h:937,lat:57.007,lon:-4.9289,r:"Lochaber"},
  {n:"Beinn Tarsuinn",h:937,lat:57.7019,lon:-5.292,r:"Ross-shire"},
  {n:"Beinn Sgulaird",h:937,lat:56.566,lon:-5.1699,r:"Argyll"},
  {n:"A' Bhuidheanach Bheag",h:936,lat:56.871,lon:-4.1993,r:"Badenoch"},
  {n:"Am Basteir",h:934,lat:57.2486,lon:-6.2037,r:"Skye"},
  {n:"Fionn Bheinn",h:933,lat:57.6114,lon:-5.103,r:"Ross-shire"},
  {n:"The Cairnwell",h:933,lat:56.8795,lon:-3.4219,r:"Cairngorms"},
  {n:"Maol Chean-dearg",h:933,lat:57.4914,lon:-5.4651,r:"Torridon"},
  {n:"Beinn Chabhair",h:933,lat:56.3258,lon:-4.6419,r:"Breadalbane"},
  {n:"Meall Buidhe (Glen Lyon)",h:932,lat:56.6165,lon:-4.4486,r:"Breadalbane"},
  {n:"Beinn Bhreac",h:931,lat:57.0106,lon:-3.7167,r:"Cairngorms"},
  {n:"Ben Chonzie",h:931,lat:56.4539,lon:-3.9918,r:"Perthshire"},
  {n:"A' Chailleach (Monadhliath)",h:930,lat:57.1095,lon:-4.1788,r:"Monadhliath"},
  {n:"Glas Leathad Mor",h:930,lat:57.6983,lon:-4.9643,r:"Ross-shire"},
  {n:"Sgurr nan Saighead",h:929,lat:57.1951,lon:-5.3495,r:"Kintail"},
  {n:"Bla Bheinn",h:928,lat:57.2199,lon:-6.0926,r:"Skye"},
  {n:"Mayar",h:928,lat:56.85,lon:-3.2453,r:"Cairngorms"},
  {n:"Ben Hope",h:927,lat:58.4134,lon:-4.608,r:"Sutherland"},
  {n:"Seana Bhraigh",h:927,lat:57.8473,lon:-4.8973,r:"Ross-shire"},
  {n:"Beinn Narnain",h:926,lat:56.221,lon:-4.7896,r:"Arrochar Alps"},
  {n:"Beinn Liath Mhor",h:926,lat:57.512,lon:-5.4002,r:"Torridon"},
  {n:"Geal Charn (Monadhliath)",h:926,lat:57.9559,lon:-4.4327,r:"Monadhliath"},
  {n:"Sgurr nan Eag",h:924,lat:57.1962,lon:-6.2109,r:"Skye"},
  {n:"Creag Pitridh",h:924,lat:56.8998,lon:-4.4835,r:"Badenoch"},
  {n:"Sgurr nan Each",h:923,lat:57.6936,lon:-5.0479,r:"Ross-shire"},
  {n:"Carn Sgulain",h:920,lat:57.1248,lon:-4.1747,r:"Monadhliath"},
  {n:"Sgurr a' Mhadaidh",h:918,lat:57.2314,lon:-6.2332,r:"Skye"},
  {n:"Meall na Teanga",h:917,lat:56.989,lon:-4.9308,r:"Lochaber"},
  {n:"Carn Aosda",h:917,lat:56.8966,lon:-3.4241,r:"Cairngorms"},
  {n:"Ben Vane",h:916,lat:56.2499,lon:-4.782,r:"Arrochar Alps"},
  {n:"Sgurr nan Ceannaichean",h:915,lat:57.4833,lon:-5.1922,r:"Ross-shire"},
  {n:"Beinn Teallach",h:915,lat:56.9359,lon:-4.6947,r:"Lochaber"},
  {n:"Leum Uilleim",h:909,lat:56.82,lon:-4.7339,r:"Lochaber"},
  {n:"A' Ghlas-bheinn",h:918,lat:57.2557,lon:-5.3035,r:"Kintail"},
  {n:"Sgiath Chuil",h:921,lat:56.4537,lon:-4.4966,r:"Breadalbane"},
  {n:"Meall a' Chrasgaidh",h:934,lat:57.7134,lon:-5.0495,r:"Ross-shire"},
  {n:"An Coileachan",h:923,lat:57.6681,lon:-4.9501,r:"Ross-shire"},
  {n:"Beinn a' Chleibh",h:916,lat:56.3907,lon:-4.836,r:"Breadalbane"},
  {n:"Moruisg",h:928,lat:57.5001,lon:-5.1703,r:"Ross-shire"},
  {n:"Tom na Gruagaich",h:922,lat:57.5811,lon:-5.5707,r:"Torridon"},
  {n:"Meall nan Eun",h:928,lat:56.5617,lon:-4.9432,r:"Argyll"},
  {n:"Meall a' Choire Leith",h:926,lat:57.4471,lon:-5.129,r:"Ross-shire"},
  {n:"Creag nan Damh",h:918,lat:57.1479,lon:-5.3353,r:"Kintail"},
  {n:"An Socach (Mullardoch)",h:921,lat:57.2582,lon:-5.1711,r:"Glen Affric"},
];

const MUNROS = MUNROS_RAW.map(m => ({ name: m.n, height: m.h, lat: m.lat, lon: m.lon, region: m.r }));

// ─── Time-of-day theme ───────────────────────────────────────────────────────
function getTimeTheme(){
  const h=new Date().getHours();
  if(h>=5&&h<7) return {bg:"#0a0c18",tint:"rgba(255,160,60,0.04)",label:"dawn"};
  if(h>=7&&h<10) return {bg:"#080b14",tint:"rgba(255,200,100,0.03)",label:"morning"};
  if(h>=10&&h<17) return {bg:"#040406",tint:"rgba(255,255,255,0.01)",label:"day"};
  if(h>=17&&h<20) return {bg:"#0a0710",tint:"rgba(255,140,50,0.04)",label:"golden"};
  if(h>=20&&h<22) return {bg:"#06081a",tint:"rgba(100,140,255,0.03)",label:"dusk"};
  return {bg:"#030308",tint:"rgba(60,80,180,0.03)",label:"night"};
}

// ─── Custom SVG Weather Icons ────────────────────────────────────────────────
function WeatherIcon({code, size=24}){
  const s=size, m=s/2, r=s/24;
  const c = (code===0||code===1) ? "sun" : code===2 ? "partcloud" : code===3 ? "cloud" :
    (code===45||code===48) ? "fog" : (code>=51&&code<=55) ? "drizzle" :
    (code>=61&&code<=63) ? "rain" : code===65 ? "heavyrain" :
    (code>=71&&code<=77) ? "snow" : (code>=80&&code<=81) ? "showers" :
    code===82 ? "heavyrain" : (code>=85&&code<=86) ? "snow" :
    (code>=95) ? "thunder" : "cloud";
  return(
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" style={{display:"block"}}>
      {(c==="sun")&&<>
        <circle cx="12" cy="12" r="4.5" fill="#fbbf24" opacity="0.9"/>
        <circle cx="12" cy="12" r="3" fill="#fcd34d"/>
        {[0,45,90,135,180,225,270,315].map(a=>{const rad=a*Math.PI/180;return <line key={a} x1={12+Math.cos(rad)*6.5} y1={12+Math.sin(rad)*6.5} x2={12+Math.cos(rad)*8.5} y2={12+Math.sin(rad)*8.5} stroke="#fbbf24" strokeWidth="1.2" strokeLinecap="round" opacity="0.7"/>})}
      </>}
      {(c==="partcloud")&&<>
        <circle cx="9" cy="9" r="3.5" fill="#fbbf24" opacity="0.7"/>
        {[0,60,120,180,240,300].map(a=>{const rad=a*Math.PI/180;return <line key={a} x1={9+Math.cos(rad)*5} y1={9+Math.sin(rad)*5} x2={9+Math.cos(rad)*6.5} y2={9+Math.sin(rad)*6.5} stroke="#fbbf24" strokeWidth="0.8" strokeLinecap="round" opacity="0.5"/>})}
        <ellipse cx="14" cy="15" rx="6" ry="3.5" fill="rgba(255,255,255,0.6)"/>
        <ellipse cx="11" cy="14.5" rx="4" ry="3" fill="rgba(255,255,255,0.5)"/>
      </>}
      {(c==="cloud")&&<>
        <ellipse cx="12" cy="14" rx="7" ry="4" fill="rgba(255,255,255,0.5)"/>
        <ellipse cx="9" cy="13" rx="5" ry="3.5" fill="rgba(255,255,255,0.45)"/>
        <ellipse cx="15" cy="13.5" rx="4.5" ry="3" fill="rgba(255,255,255,0.4)"/>
      </>}
      {(c==="fog")&&<>
        {[9,12.5,16].map((y,i)=><line key={i} x1={4+i} y1={y} x2={20-i} y2={y} stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" strokeLinecap="round"/>)}
      </>}
      {(c==="drizzle")&&<>
        <ellipse cx="12" cy="10" rx="6.5" ry="3.5" fill="rgba(255,255,255,0.45)"/>
        <ellipse cx="9" cy="9.5" rx="4.5" ry="3" fill="rgba(255,255,255,0.4)"/>
        {[8,12,16].map((x,i)=><line key={i} x1={x} y1={15+i*0.5} x2={x-0.5} y2={17+i*0.5} stroke="#60a5fa" strokeWidth="1" strokeLinecap="round" opacity="0.6"/>)}
      </>}
      {(c==="rain")&&<>
        <ellipse cx="12" cy="9" rx="6.5" ry="3.5" fill="rgba(255,255,255,0.45)"/>
        <ellipse cx="9" cy="8.5" rx="4.5" ry="3" fill="rgba(255,255,255,0.4)"/>
        {[7,10,13,16].map((x,i)=><line key={i} x1={x} y1={14} x2={x-1} y2={18} stroke="#60a5fa" strokeWidth="1.2" strokeLinecap="round" opacity="0.7"/>)}
      </>}
      {(c==="heavyrain")&&<>
        <ellipse cx="12" cy="8" rx="6.5" ry="3.5" fill="rgba(255,255,255,0.5)"/>
        <ellipse cx="9" cy="7.5" rx="4.5" ry="3" fill="rgba(255,255,255,0.4)"/>
        {[6,9,12,15,18].map((x,i)=><line key={i} x1={x} y1={13} x2={x-1.5} y2={19} stroke="#3b82f6" strokeWidth="1.4" strokeLinecap="round" opacity="0.8"/>)}
      </>}
      {(c==="snow")&&<>
        <ellipse cx="12" cy="9" rx="6.5" ry="3.5" fill="rgba(255,255,255,0.45)"/>
        {[[8,15],[12,16],[16,14.5],[10,18.5],[14,19]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r="1.2" fill="rgba(255,255,255,0.7)"/>)}
      </>}
      {(c==="showers")&&<>
        <circle cx="8" cy="8" r="2.5" fill="#fbbf24" opacity="0.5"/>
        <ellipse cx="14" cy="11" rx="5.5" ry="3" fill="rgba(255,255,255,0.45)"/>
        {[11,14,17].map((x,i)=><line key={i} x1={x} y1={15.5} x2={x-0.8} y2={19} stroke="#60a5fa" strokeWidth="1.1" strokeLinecap="round" opacity="0.6"/>)}
      </>}
      {(c==="thunder")&&<>
        <ellipse cx="12" cy="8" rx="6.5" ry="3.5" fill="rgba(255,255,255,0.5)"/>
        <path d="M13 12l-2 4h3l-2 5 5-6h-3l2-3z" fill="#fbbf24" opacity="0.9"/>
        {[8,16].map((x,i)=><line key={i} x1={x} y1={13} x2={x-1} y2={18} stroke="#3b82f6" strokeWidth="1.2" strokeLinecap="round" opacity="0.5"/>)}
      </>}
    </svg>
  );
}

// ─── WMO code map (label + danger score only, icons handled by WeatherIcon) ──
const WMO = {
  0:{label:"Clear Sky",ds:0}, 1:{label:"Mainly Clear",ds:0},
  2:{label:"Partly Cloudy",ds:5}, 3:{label:"Overcast",ds:10},
  45:{label:"Fog",ds:30}, 48:{label:"Icy Fog",ds:40},
  51:{label:"Light Drizzle",ds:10}, 53:{label:"Drizzle",ds:15},
  55:{label:"Heavy Drizzle",ds:20},
  61:{label:"Light Rain",ds:20}, 63:{label:"Rain",ds:30},
  65:{label:"Heavy Rain",ds:35},
  71:{label:"Light Snow",ds:35}, 73:{label:"Snow",ds:45},
  75:{label:"Heavy Snow",ds:55}, 77:{label:"Snow Grains",ds:30},
  80:{label:"Rain Showers",ds:20}, 81:{label:"Showers",ds:30},
  82:{label:"Heavy Showers",ds:40}, 85:{label:"Snow Showers",ds:40},
  86:{label:"Heavy Snow Showers",ds:50},
  95:{label:"Thunderstorm",ds:70}, 96:{label:"Thunderstorm+Hail",ds:80},
};

// ─── Risk colours ──────────────────────────────────────────────────────────────
const RISK_GRADIENTS = [
  ["#021a06","#043d10","#065518"],["#0d1f02","#2a4a04","#3a6205"],
  ["#1e1000","#4a2800","#6b3a00"],["#280600","#5c0e00","#7a1200"],
  ["#0f0000","#240000","#3d0000"],
];
const RISK_ACCENT = ["#22c55e","#84cc16","#f59e0b","#f97316","#dc2626"];
const RISK_LABELS = ["LOW","MODERATE","HIGH","SEVERE","EXTREME"];

// ─── Silhouettes ───────────────────────────────────────────────────────────────
const SILHOUETTES = {
  "Ben Nevis": [[0,80],[15,74],[32,62],[48,50],[60,42],[70,34],[78,26],[84,20],[89,16],[93,12],[97,10],[100,9],[103,10],[107,13],[112,18],[118,25],[125,32],[133,40],[143,50],[156,60],[170,69],[185,75],[200,80]],
  "Ben Macdui": [[0,80],[20,72],[42,58],[60,44],[74,32],[84,22],[92,15],[98,11],[104,9],[110,10],[116,14],[124,22],[134,33],[146,45],[160,57],[175,67],[190,75],[200,80]],
  "Schiehallion": [[0,80],[30,78],[55,70],[72,58],[84,44],[92,30],[97,18],[101,10],[104,5],[107,10],[112,20],[118,32],[126,46],[138,60],[153,71],[170,77],[200,80]],
  "Buachaille Etive Mor": [[0,80],[12,78],[24,72],[36,62],[48,50],[58,38],[66,26],[72,16],[77,9],[82,4],[87,8],[92,16],[99,28],[109,42],[122,56],[138,67],[157,75],[200,80]],
  "Liathach": [[0,80],[6,74],[12,64],[18,52],[24,40],[30,28],[35,18],[39,11],[43,6],[47,9],[51,5],[55,2],[59,5],[63,7],[67,3],[71,6],[75,10],[79,6],[83,4],[87,8],[92,14],[99,24],[111,38],[126,52],[144,63],[164,72],[200,80]],
  "An Teallach": [[0,80],[8,74],[16,64],[24,52],[32,40],[38,30],[43,21],[47,14],[51,9],[55,6],[59,10],[62,14],[65,9],[68,5],[71,8],[74,12],[77,8],[80,6],[83,9],[87,14],[92,20],[100,30],[112,42],[127,55],[144,65],[163,73],[200,80]],
  "Bidean nam Bian": [[0,80],[10,74],[20,62],[30,50],[38,38],[45,27],[50,18],[54,11],[58,7],[62,10],[67,16],[71,11],[75,7],[79,11],[83,17],[90,28],[100,40],[114,54],[130,65],[148,73],[200,80]],
  "Ben Lomond": [[0,80],[26,75],[50,65],[68,53],[82,41],[92,30],[99,21],[104,14],[109,9],[113,6],[117,9],[122,16],[129,26],[140,39],[155,52],[170,64],[185,73],[200,80]],
  "Lochnagar": [[0,80],[16,74],[32,63],[48,52],[60,42],[70,33],[77,24],[82,16],[86,10],[90,7],[94,10],[98,16],[104,24],[112,33],[122,43],[133,53],[146,62],[162,71],[200,80]],
  "Ben Cruachan": [[0,80],[14,74],[28,63],[42,51],[54,39],[63,28],[70,18],[75,11],[80,7],[85,10],[90,14],[94,10],[98,7],[102,10],[107,17],[115,27],[126,40],[140,53],[156,64],[173,73],[200,80]],
  "Sgurr Alasdair": [[0,80],[10,76],[20,68],[30,56],[40,42],[48,30],[54,18],[59,9],[63,3],[67,8],[72,16],[80,28],[92,44],[108,58],[127,68],[148,76],[200,80]],
};
function proceduralSil(name){
  const s=name.split("").reduce((a,c)=>a+c.charCodeAt(0),0);
  const sr=(n,lo,hi)=>lo+(Math.abs(Math.sin(s*n+n*127))*10000%1)*(hi-lo);
  const style=s%5,peakX=80+sr(1,-20,30),peakY=4+sr(2,0,14),pts=[[0,80]];
  if(style===0)pts.push([peakX-50-sr(3,0,20),75],[peakX-25,55],[peakX-8,25],[peakX,peakY],[peakX+8,22],[peakX+30,52],[peakX+55+sr(4,0,20),74]);
  else if(style===1)pts.push([peakX-55,72],[peakX-35,48],[peakX-18,22],[peakX-5,peakY+2],[peakX+5,peakY],[peakX+15,peakY+2],[peakX+30,22],[peakX+50,48],[peakX+65,72]);
  else if(style===2)pts.push([peakX-65,72],[peakX-45,52],[peakX-28,32],[peakX-12,16],[peakX,peakY],[peakX+12,18],[peakX+26,30],[peakX+40,45],[peakX+60,68]);
  else if(style===3){const s2x=peakX-14-sr(5,0,10);pts.push([peakX-60,72],[peakX-40,52],[s2x-6,22],[s2x,peakY+10],[s2x+6,22],[(s2x+peakX)/2,30],[peakX-4,20],[peakX,peakY],[peakX+4,20],[peakX+30,50],[peakX+55,72]);}
  else pts.push([peakX-60,72],[peakX-45,52],[peakX-32,36],[peakX-20,20],[peakX-10,12],[peakX-5,8],[peakX,peakY],[peakX+5,10],[peakX+12,6],[peakX+18,12],[peakX+25,22],[peakX+38,40],[peakX+55,60],[peakX+70,74]);
  pts.push([200,80]);return pts;
}
function getSil(name){return SILHOUETTES[name]||proceduralSil(name);}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function toF(c){return Math.round(c*9/5+32);}
function windDir(deg){return["N","NE","E","SE","S","SW","W","NW"][Math.round(deg/45)%8];}
function formatHour(iso){const h=new Date(iso).getHours();return h===0?"12am":h===12?"12pm":h>12?`${h-12}pm`:`${h}am`;}
function formatDay(iso){return new Date(iso).toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"});}

// ─── Risk calculation ──────────────────────────────────────────────────────────
function calcRisk(wx){
  if(!wx)return{score:0,band:0,label:"Unknown",detail:[]};
  const wind=wx.wind_speed_10m||0,app=wx.apparent_temperature??10,wc=wx.weather_code??0,prec=wx.precipitation_probability??0,hum=wx.relative_humidity_2m??60;
  const wmo=WMO[wc]||{ds:0};
  const ws=wind>50?40:wind>40?32:wind>30?24:wind>20?16:wind>10?8:0;
  const ts=app<-10?25:app<-5?18:app<0?12:app<5?5:0;
  const cs=Math.round((wmo.ds/80)*20);
  const ps=Math.round((prec/100)*10);
  const hs=hum>90?5:hum>80?3:hum>70?1:0;
  const score=Math.min(100,ws+ts+cs+ps+hs);
  const band=score>=80?4:score>=60?3:score>=40?2:score>=20?1:0;
  return{score,band,label:RISK_LABELS[band],detail:[
    {factor:"Wind",score:ws,max:40,value:`${Math.round(wind)} mph`},
    {factor:"Wind chill",score:ts,max:25,value:`Feels ${Math.round(app)}°C`},
    {factor:"Conditions",score:cs,max:20,value:wmo.label||"—"},
    {factor:"Precipitation",score:ps,max:10,value:`${prec}%`},
    {factor:"Humidity/Mist",score:hs,max:5,value:`${hum}%`},
  ]};
}

// ─── Midge forecast (1-5, Apr-Oct) ─────────────────────────────────────────
function calcMidge(wx,height){
  const month=new Date().getMonth();
  if(month<3||month>9)return{level:1,label:"1 — Very Low",desc:"Outside midge season (Nov–Mar)",color:"#555",score:0};
  if(!wx)return{level:1,label:"1 — Very Low",desc:"No weather data",color:"#555",score:0};
  const temp=wx.temperature_2m??10,wind=wx.wind_speed_10m??0,hum=wx.relative_humidity_2m??60;
  const altF=height>900?0.05:height>700?0.15:height>500?0.4:height>300?0.7:1.0;
  const windF=wind>12?0:wind>8?0.05:wind>6?0.15:wind>4?0.4:wind>2?0.7:1.0;
  const tempF=(temp>=12&&temp<=18)?1.0:(temp>=9&&temp<=22)?0.6:(temp>=5&&temp<=25)?0.25:0.0;
  const humF=hum>85?1.0:hum>75?0.8:hum>65?0.5:hum>50?0.2:0.05;
  const seasonF=[0,0,0,0.15,0.4,0.7,0.95,1.0,0.6,0.2,0,0][month]??0;
  const raw=(windF*0.35+tempF*0.2+humF*0.2+seasonF*0.25)*altF;
  const level=raw>0.65?5:raw>0.45?4:raw>0.25?3:raw>0.08?2:1;
  const labels=["","1 — Very Low","2 — Low","3 — Moderate","4 — High","5 — Severe"];
  const colors=["","#22c55e","#84cc16","#eab308","#f97316","#dc2626"];
  const descs=["","Minimal midge activity expected","Some midges possible — repellent advisable","Noticeable midge activity — use repellent","Heavy midge activity — strong repellent & head net recommended","Extreme midge conditions — avoid sheltered glens at dawn/dusk"];
  return{level,label:labels[level],desc:descs[level],color:colors[level],score:Math.round(raw*100)};
}

// ─── Weather fetch ─────────────────────────────────────────────────────────────
const wxCache={};
async function fetchWeather(munro){
  if(wxCache[munro.name])return wxCache[munro.name];
  const url=`https://api.open-meteo.com/v1/forecast?latitude=${munro.lat}&longitude=${munro.lon}&elevation=${munro.height}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,relative_humidity_2m,surface_pressure,precipitation_probability,wind_gusts_10m&hourly=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m,precipitation_probability,wind_gusts_10m,relative_humidity_2m&daily=weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,wind_direction_10m_dominant,sunrise,sunset,precipitation_probability_max,wind_gusts_10m_max&wind_speed_unit=mph&temperature_unit=celsius&timezone=Europe%2FLondon&forecast_days=4`;
  try{const res=await fetch(url);if(!res.ok)throw 0;const w=await res.json();if(w?.current?.temperature_2m==null)throw 0;wxCache[munro.name]=w;return w;}
  catch{const m=generateMock(munro);wxCache[munro.name]=m;return m;}
}

// ─── Mock fallback ─────────────────────────────────────────────────────────────
function sr(seed,min,max){const x=Math.sin(seed)*10000;return min+(x-Math.floor(x))*(max-min);}
const MC=[0,1,2,3,61,63,71,73,80,95];
function generateMock(m){
  const s=m.name.split("").reduce((a,c)=>a+c.charCodeAt(0),0);
  const altP=Math.round((m.height-900)/100)*1.5,bt=Math.round(sr(s,-6,8)-altP);
  const ws=Math.round(sr(s+1,8,60)),wd=Math.round(sr(s+2,0,359));
  const hum=Math.round(sr(s+3,55,98)),pres=Math.round(sr(s+4,940,1020));
  const wc=MC[Math.floor(sr(s+5,0,MC.length))],prec=Math.round(sr(s+6,0,100));
  const now=new Date();now.setMinutes(0,0,0);
  const hT=[],hTe=[],hC=[],hW=[],hWG=[],hWD=[],hP=[],hH=[];
  for(let i=0;i<48;i++){const t=new Date(now.getTime()+i*3600000);hT.push(t.toISOString().slice(0,16));hTe.push(+(bt+Math.sin((t.getHours()-6)*Math.PI/12)*2+sr(s+i*7,-1,1)).toFixed(1));hC.push(i%8===0?MC[Math.floor(sr(s+i,0,MC.length))]:wc);hW.push(Math.round(ws+sr(s+i*3,-10,10)));hWG.push(Math.round(ws*1.4+sr(s+i*4,-5,15)));hWD.push(Math.round((wd+sr(s+i*2,-20,20)+360)%360));hP.push([63,73,80,81,95].includes(wc)?Math.round(sr(s+i*5,25,90)):Math.round(sr(s+i*5,0,25)));hH.push(Math.round(hum+sr(s+i*6,-10,10)));}
  const dT=[],dC=[],dMx=[],dMn=[],dW=[],dWG=[],dWD=[],dSR=[],dSS=[],dP=[];
  for(let i=0;i<4;i++){const d=new Date(now);d.setDate(d.getDate()+i);d.setHours(0,0,0,0);dT.push(d.toISOString().slice(0,10));dC.push(MC[Math.floor(sr(s+i*11,0,MC.length))]);dMx.push(+(bt+sr(s+i*13,0,4)).toFixed(1));dMn.push(+(bt-sr(s+i*17,2,7)).toFixed(1));dW.push(Math.round(ws+sr(s+i*19,0,20)));dWG.push(Math.round(ws*1.4+sr(s+i*20,5,20)));dWD.push(Math.round((wd+i*25)%360));const rise=new Date(d);rise.setHours(5,20+i*6,0);const set=new Date(d);set.setHours(20,15-i*9,0);dSR.push(rise.toISOString().slice(0,16));dSS.push(set.toISOString().slice(0,16));dP.push([63,73,80,81,95].includes(dC[i])?Math.round(sr(s+i*23,40,90)):Math.round(sr(s+i*23,0,30)));}
  return{current:{temperature_2m:bt,apparent_temperature:bt-Math.round(ws/8),weather_code:wc,wind_speed_10m:ws,wind_direction_10m:wd,wind_gusts_10m:Math.round(ws*1.4),relative_humidity_2m:hum,surface_pressure:pres,precipitation_probability:prec},hourly:{time:hT,temperature_2m:hTe,weather_code:hC,wind_speed_10m:hW,wind_gusts_10m:hWG,wind_direction_10m:hWD,precipitation_probability:hP,relative_humidity_2m:hH},daily:{time:dT,weather_code:dC,temperature_2m_max:dMx,temperature_2m_min:dMn,wind_speed_10m_max:dW,wind_gusts_10m_max:dWG,wind_direction_10m_dominant:dWD,sunrise:dSR,sunset:dSS,precipitation_probability_max:dP},_isMock:true};
}

// ─── Bagging storage ───────────────────────────────────────────────────────────
const BAG_KEY = "munro_bagged";
function loadBagged(){try{const d=localStorage.getItem(BAG_KEY);return d?JSON.parse(d):{};}catch{return{};}}
function saveBagged(b){try{localStorage.setItem(BAG_KEY,JSON.stringify(b));}catch{}}

// ─── Context ───────────────────────────────────────────────────────────────────
const TempUnitCtx=createContext({useFahrenheit:false,toggle:()=>{}});
function useTempUnit(){return useContext(TempUnitCtx);}

// ─── Mountain SVG ──────────────────────────────────────────────────────────────
function MountainSVG({name,w=420,h=120,accent="rgba(255,255,255,0.85)",mini=false}){
  const pts=getSil(name);const ys=pts.map(p=>p[1]);
  const minY=Math.min(...ys),maxY=Math.max(...ys),rY=maxY-minY||1;
  const scaled=pts.map(([x,y])=>[(x/200)*w,((y-minY)/rY)*h]);
  const poly=scaled.map(p=>p.join(",")).join(" ");
  const threshold=h*0.20;
  const snowPts=[...scaled.filter(p=>p[1]<=threshold)];
  if(snowPts.length>1){const f=snowPts[0],l=snowPts[snowPts.length-1];snowPts.push([l[0],threshold],[f[0],threshold]);}
  const seed=name.split("").reduce((a,c)=>a+c.charCodeAt(0),0);
  return(
    <svg viewBox={`0 0 ${w} ${h}`} style={{width:"100%",height:"100%",display:"block"}} preserveAspectRatio="xMidYMax meet">
      <defs><linearGradient id={`mfg-${seed}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="rgba(255,255,255,0.09)"/><stop offset="100%" stopColor="rgba(255,255,255,0.01)"/></linearGradient></defs>
      <polygon points={poly} fill={`url(#mfg-${seed})`} stroke="none"/>
      <polyline points={poly} fill="none" stroke={accent} strokeWidth={mini?0.7:1.3} strokeLinejoin="round" strokeLinecap="round"/>
      {snowPts.length>2&&<polygon points={snowPts.map(p=>p.join(",")).join(" ")} fill="rgba(255,255,255,0.22)" stroke="rgba(255,255,255,0.5)" strokeWidth="0.6"/>}
    </svg>
  );
}

// ─── Fog overlay for hero ──────────────────────────────────────────────────────
function FogOverlay(){
  return(
    <div style={{position:"absolute",bottom:0,left:0,right:0,height:80,overflow:"hidden",pointerEvents:"none"}}>
      <div style={{position:"absolute",bottom:-10,left:"-30%",right:"-30%",height:50,background:"radial-gradient(ellipse at center, rgba(255,255,255,0.06) 0%, transparent 70%)",animation:"fogDrift 12s ease-in-out infinite alternate"}}/>
      <div style={{position:"absolute",bottom:5,left:"-20%",right:"-20%",height:35,background:"radial-gradient(ellipse at 60% center, rgba(255,255,255,0.04) 0%, transparent 70%)",animation:"fogDrift2 16s ease-in-out infinite alternate"}}/>
    </div>
  );
}

// ─── SVG Icons ─────────────────────────────────────────────────────────────────
function MidgeIcon({size=16,color="#fff"}){
  return(<svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{display:"inline-block",verticalAlign:"middle"}}>
    <ellipse cx="12" cy="13" rx="4.5" ry="5.5" fill={color} opacity="0.25" stroke={color} strokeWidth="1.2"/>
    <ellipse cx="12" cy="13" rx="2.8" ry="3.5" fill={color} opacity="0.4"/>
    <circle cx="12" cy="8.5" r="2.2" fill={color} opacity="0.5" stroke={color} strokeWidth="0.8"/>
    <line x1="12" y1="6" x2="10.5" y2="3" stroke={color} strokeWidth="0.9" strokeLinecap="round"/>
    <line x1="12" y1="6" x2="13.5" y2="3" stroke={color} strokeWidth="0.9" strokeLinecap="round"/>
    <line x1="7.5" y1="11" x2="4" y2="8.5" stroke={color} strokeWidth="0.7" strokeLinecap="round" opacity="0.6"/>
    <line x1="16.5" y1="11" x2="20" y2="8.5" stroke={color} strokeWidth="0.7" strokeLinecap="round" opacity="0.6"/>
    <ellipse cx="6" cy="9" rx="2.8" ry="1" fill={color} opacity="0.12" transform="rotate(-30 6 9)"/>
    <ellipse cx="18" cy="9" rx="2.8" ry="1" fill={color} opacity="0.12" transform="rotate(30 18 9)"/>
    <line x1="9" y1="17" x2="7.5" y2="20" stroke={color} strokeWidth="0.6" strokeLinecap="round" opacity="0.5"/>
    <line x1="12" y1="18.5" x2="12" y2="21.5" stroke={color} strokeWidth="0.6" strokeLinecap="round" opacity="0.5"/>
    <line x1="15" y1="17" x2="16.5" y2="20" stroke={color} strokeWidth="0.6" strokeLinecap="round" opacity="0.5"/>
  </svg>);
}
function RiskIcon({size=16,color="#fff"}){
  return(<svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{display:"inline-block",verticalAlign:"middle"}}>
    <path d="M12 3L2 21h20L12 3z" fill={color} opacity="0.15" stroke={color} strokeWidth="1.2" strokeLinejoin="round"/>
    <path d="M12 3L6 15h12L12 3z" fill={color} opacity="0.25"/>
    <line x1="12" y1="9" x2="12" y2="14.5" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
    <circle cx="12" cy="17" r="1.1" fill={color}/>
    <path d="M7 18.5L4.5 21h15L17 18.5" stroke={color} strokeWidth="0.6" opacity="0.3" strokeLinecap="round"/>
  </svg>);
}

// ─── Temp display ──────────────────────────────────────────────────────────────
function TempDisplay({celsius,big=false,style={}}){
  const{useFahrenheit,toggle}=useTempUnit();
  const c=Math.round(celsius),f=toF(celsius);
  const pri=useFahrenheit?`${f}°F`:`${c}°C`;
  const sec=useFahrenheit?`${c}°C`:`${f}°F`;
  if(big)return(
    <div onClick={toggle} title="Tap to switch °C / °F" style={{display:"flex",alignItems:"flex-start",gap:10,cursor:"pointer",userSelect:"none",...style}}>
      <div style={{fontSize:84,fontWeight:900,letterSpacing:-5,lineHeight:1,color:"#fff",fontFamily:FF,fontVariantNumeric:"tabular-nums",textShadow:"0 0 80px rgba(255,255,255,0.2)"}}>{pri}</div>
      <div style={{paddingTop:14,display:"flex",flexDirection:"column",gap:3}}>
        <div style={{fontSize:22,fontWeight:700,color:"rgba(255,255,255,0.38)",letterSpacing:-1}}>{sec}</div>
        <div style={{fontSize:8,letterSpacing:1.5,color:"rgba(255,255,255,0.2)",textTransform:"uppercase"}}>tap to swap</div>
      </div>
    </div>
  );
  return(
    <div onClick={toggle} style={{display:"flex",alignItems:"baseline",gap:5,cursor:"pointer",userSelect:"none",...style}}>
      <span style={{fontSize:28,fontWeight:900,color:"#fff",letterSpacing:-1}}>{pri}</span>
      <span style={{fontSize:15,fontWeight:600,color:"rgba(255,255,255,0.38)"}}>{sec}</span>
    </div>
  );
}

// ─── Wind compass ──────────────────────────────────────────────────────────────
function WindCompass({dir}){
  const rad=(dir*Math.PI)/180,cx=20,cy=20;
  const ax=cx+Math.sin(rad)*10,ay=cy-Math.cos(rad)*10;
  const bx=cx-Math.sin(rad)*5,by=cy+Math.cos(rad)*5;
  return(<svg width="40" height="40" viewBox="0 0 40 40">
    <circle cx={cx} cy={cy} r="15" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1"/>
    {["N","E","S","W"].map((d,i)=>{const a=i*Math.PI/2;return <text key={d} x={cx+Math.sin(a)*11} y={cy-Math.cos(a)*11+3.5} fill={d==="N"?"#fff":"rgba(255,255,255,0.3)"} fontSize="5.5" textAnchor="middle" fontWeight={d==="N"?"700":"400"}>{d}</text>;})}
    <line x1={bx} y1={by} x2={ax} y2={ay} stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round"/>
    <circle cx={ax} cy={ay} r="2.5" fill="#60a5fa"/><circle cx={cx} cy={cy} r="2" fill="rgba(255,255,255,0.2)"/>
  </svg>);
}

// ─── Risk display ──────────────────────────────────────────────────────────────
function RiskBar({band,score,large=false}){
  const color=RISK_ACCENT[band],label=RISK_LABELS[band];
  if(large)return(
    <div style={{display:"flex",alignItems:"center",gap:8}}>
      <div style={{background:`${color}15`,borderRadius:8,padding:5,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><RiskIcon size={18} color={color}/></div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:12,fontWeight:700,color:"#fff",letterSpacing:0.5,fontFamily:FF}}>SUMMIT RISK: <span style={{color}}>{score}/100</span></div>
        <div style={{fontSize:10,color:"rgba(255,255,255,0.5)",marginTop:1}}>{label} risk conditions</div>
      </div>
      <div style={{width:50,height:4,background:"rgba(255,255,255,0.08)",borderRadius:2,overflow:"hidden",flexShrink:0}}>
        <div style={{width:`${score}%`,height:"100%",background:color,borderRadius:2,transition:"width .6s"}}/>
      </div>
    </div>
  );
  return <span style={{fontSize:8,fontWeight:700,letterSpacing:1.5,color,background:`${color}22`,border:`1px solid ${color}44`,borderRadius:3,padding:"2px 5px"}}>{label}</span>;
}

// ─── Risk breakdown ────────────────────────────────────────────────────────────
function RiskBreakdown({detail}){
  return(
    <div style={{background:"rgba(0,0,0,0.3)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:12,padding:14,marginTop:8}}>
      <div style={{fontSize:9,letterSpacing:2,color:"rgba(255,255,255,0.35)",marginBottom:10,fontFamily:FF}}>HOW RISK IS CALCULATED</div>
      {detail.map(d=>{const pct=(d.score/d.max)*100,col=pct>70?"#ef4444":pct>40?"#f59e0b":"#3b82f6";return(
        <div key={d.factor} style={{marginBottom:8}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
            <span style={{fontSize:10,color:"rgba(255,255,255,0.5)"}}>{d.factor}</span>
            <span style={{fontSize:10,color:"rgba(255,255,255,0.35)"}}>{d.value} <span style={{color:col,fontWeight:700}}>{d.score}/{d.max}</span></span>
          </div>
          <div style={{height:2,background:"rgba(255,255,255,0.08)",borderRadius:1,overflow:"hidden"}}><div style={{width:`${pct}%`,height:"100%",background:col,borderRadius:1}}/></div>
        </div>
      );})}
      <div style={{fontSize:9,color:"rgba(255,255,255,0.22)",marginTop:10,lineHeight:1.5}}>Mountaineering Scotland & MWIS guidance. Weather from Open-Meteo summit-elevation model.</div>
    </div>
  );
}

// ─── Midge badge ───────────────────────────────────────────────────────────────
function MidgeBadge({wx,height}){
  const m=calcMidge(wx,height);if(m.level<=1)return null;
  return(<span style={{fontSize:8,fontWeight:700,letterSpacing:1,color:m.color,background:`${m.color}18`,border:`1px solid ${m.color}44`,borderRadius:3,padding:"2px 6px 2px 4px",marginTop:2,display:"inline-flex",alignItems:"center",gap:3}}><MidgeIcon size={11} color={m.color}/> {m.level}/5</span>);
}

// ─── Midge panel ───────────────────────────────────────────────────────────────
function MidgePanel({wx,height}){
  const m=calcMidge(wx,height);
  const factors=[
    {label:"Wind",desc:wx?(wx.wind_speed_10m>6?"Suppressing midges":"Low wind — midges can fly"):"—",pct:wx?Math.max(0,100-wx.wind_speed_10m*8):50},
    {label:"Temperature",desc:wx?((wx.temperature_2m>=12&&wx.temperature_2m<=18)?"Peak midge range (12–18°C)":"Outside peak range"):"—",pct:wx?((wx.temperature_2m>=12&&wx.temperature_2m<=18)?90:30):50},
    {label:"Humidity",desc:wx?(wx.relative_humidity_2m>70?"High humidity favours midges":"Drier air suppresses midges"):"—",pct:wx?Math.min(100,wx.relative_humidity_2m):50},
    {label:"Altitude",desc:height>600?"High altitude reduces midges":"Valley-level — more midges likely",pct:Math.max(0,100-height/10)},
    {label:"Season",desc:(()=>{const mo=new Date().getMonth();return mo>=6&&mo<=7?"Peak midge season (Jul–Aug)":mo>=3&&mo<=9?"Active midge season (Apr–Oct)":"Dormant — no midges (Nov–Mar)";})(),pct:[0,0,0,15,40,70,95,100,60,20,0,0][new Date().getMonth()]||0},
  ];
  return(
    <div style={{background:`linear-gradient(135deg,rgba(0,0,0,0.4) 0%,${m.color}08 100%)`,border:`1px solid ${m.color}28`,borderRadius:14,padding:16,marginTop:12}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
        <div style={{background:`${m.color}18`,borderRadius:10,padding:6,display:"flex",alignItems:"center",justifyContent:"center"}}><MidgeIcon size={22} color={m.color}/></div>
        <div>
          <div style={{fontSize:13,fontWeight:800,color:"#fff",letterSpacing:0.5,fontFamily:FF}}>MIDGE ACTIVITY: <span style={{color:m.color}}>{m.level}/5 {m.label.split(" — ")[1]||m.label}</span></div>
          <div style={{fontSize:11,color:"rgba(255,255,255,0.55)",marginTop:2}}>{m.desc}</div>
        </div>
      </div>
      <div style={{display:"flex",gap:3,marginBottom:14}}>{[1,2,3,4,5].map(i=><div key={i} style={{flex:1,height:6,borderRadius:3,background:i<=m.level?m.color:"rgba(255,255,255,0.08)",opacity:i<=m.level?1:0.4,transition:"all .4s"}}/>)}</div>
      {factors.map(f=>(
        <div key={f.label} style={{marginBottom:8}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
            <span style={{fontSize:10,color:"rgba(255,255,255,0.45)",fontWeight:600}}>{f.label}</span>
            <span style={{fontSize:10,color:"rgba(255,255,255,0.55)"}}>{f.desc}</span>
          </div>
          <div style={{height:2,background:"rgba(255,255,255,0.06)",borderRadius:1,overflow:"hidden"}}><div style={{width:`${f.pct}%`,height:"100%",background:f.pct>60?m.color:"rgba(255,255,255,0.2)",borderRadius:1,opacity:0.7}}/></div>
        </div>
      ))}
      <div style={{fontSize:9,color:"rgba(255,255,255,0.18)",marginTop:10,lineHeight:1.5}}>Midge model based on APS Biocontrol & Smidge research. Wind speed is the strongest predictor.</div>
    </div>
  );
}

// ─── Skeleton loader ───────────────────────────────────────────────────────────
function SkeletonLoader({type="hero"}){
  const bar=(w,h,d=0)=>({width:`${w}%`,height:h,background:"rgba(255,255,255,0.06)",borderRadius:h>10?12:6,animation:"pulse 1.5s ease-in-out infinite",animationDelay:`${d}s`});
  if(type==="card")return(
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",background:"rgba(255,255,255,0.02)",borderRadius:14,border:"1px solid rgba(255,255,255,0.05)"}}>
      <div style={{flex:1}}><div style={bar(40,10)}/><div style={{...bar(65,14,0.1),marginTop:6}}/><div style={{...bar(25,8,0.2),marginTop:4}}/></div>
      <div style={{width:80,height:40,...bar(100,40,0.15),borderRadius:8}}/>
      <div style={{textAlign:"right",marginLeft:12}}><div style={bar(100,20,0.2)}/><div style={{...bar(100,10,0.3),marginTop:4}}/></div>
    </div>
  );
  return(
    <div style={{display:"flex",flexDirection:"column",gap:12,padding:"16px 0"}}>
      <div style={bar(60,56)}/><div style={bar(45,14,0.1)}/><div style={bar(80,4,0.15)}/><div style={bar(35,12,0.2)}/>
    </div>
  );
}

// ─── Hourly strip ──────────────────────────────────────────────────────────────
function HourlyStrip({hourly,current}){
  const{useFahrenheit}=useTempUnit();
  const now=new Date(),times=hourly.time||[];
  const start=Math.max(0,times.findIndex(t=>new Date(t)>=now));
  return(
    <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:4,scrollbarWidth:"none"}}>
      {times.slice(start,start+24).map((t,i)=>{
        const idx=start+i,isNow=i===0;
        const wc=isNow&&current?current.weather_code:hourly.weather_code?.[idx];
        const wmo=WMO[wc]||{label:"?"};
        const temp=isNow&&current?current.temperature_2m:hourly.temperature_2m?.[idx];
        const wind=isNow&&current?current.wind_speed_10m:hourly.wind_speed_10m?.[idx];
        const gusts=isNow&&current?current.wind_gusts_10m:hourly.wind_gusts_10m?.[idx];
        const prec=isNow&&current?(current.precipitation_probability||0):(hourly.precipitation_probability?.[idx]||0);
        const dispTemp=temp!=null?(useFahrenheit?`${toF(temp)}°F`:`${Math.round(temp)}°C`):"-";
        return(
          <div key={t} style={{flexShrink:0,width:60,background:isNow?"rgba(255,255,255,0.13)":"rgba(255,255,255,0.03)",border:`1px solid ${isNow?"rgba(255,255,255,0.25)":"rgba(255,255,255,0.06)"}`,borderRadius:12,padding:"10px 0",textAlign:"center",animation:isNow?undefined:`fadeIn 0.3s ease ${i*0.03}s both`}}>
            <div style={{fontSize:9,color:isNow?"#fff":"rgba(255,255,255,0.38)",letterSpacing:1,marginBottom:5,fontFamily:FF}}>{isNow?"NOW":formatHour(t)}</div>
            <div style={{marginBottom:5,display:"flex",justifyContent:"center"}}><WeatherIcon code={wc??3} size={22}/></div>
            <div style={{fontSize:13,fontWeight:700,color:"#fff",marginBottom:2}}>{dispTemp}</div>
            <div style={{fontSize:9,color:"rgba(255,255,255,0.3)",marginBottom:prec>0?2:0}}>
              {wind!=null?`${Math.round(wind)}mph`:""}{gusts!=null&&wind!=null?<span style={{color:"rgba(255,255,255,0.2)"}}> ↑{Math.round(gusts)}</span>:""}
            </div>
            {prec>0&&<div style={{fontSize:9,color:"#60a5fa"}}>{prec}%</div>}
          </div>
        );
      })}
    </div>
  );
}

// ─── Daily forecast ────────────────────────────────────────────────────────────
function DailyForecast({daily}){
  const{useFahrenheit}=useTempUnit();
  return(
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      {(daily.time||[]).slice(0,4).map((d,i)=>{
        const wc=daily.weather_code?.[i];const wmo=WMO[wc]||{label:"Unknown"};
        const max=daily.temperature_2m_max?.[i],min=daily.temperature_2m_min?.[i];
        const wind=daily.wind_speed_10m_max?.[i],gusts=daily.wind_gusts_10m_max?.[i];
        const wD=daily.wind_direction_10m_dominant?.[i];const prec=daily.precipitation_probability_max?.[i];
        const sunrise=daily.sunrise?.[i],sunset=daily.sunset?.[i];const isT=i===0;
        const dispMax=max!=null?(useFahrenheit?`${toF(max)}°F`:`${Math.round(max)}°C`):"-";
        const dispMin=min!=null?(useFahrenheit?`${toF(min)}°F`:`${Math.round(min)}°C`):"-";
        return(
          <div key={d} style={{background:"linear-gradient(135deg,rgba(255,255,255,0.04) 0%,rgba(255,255,255,0.01) 100%)",border:"1px solid rgba(255,255,255,0.08)",borderLeft:`3px solid ${isT?"rgba(255,255,255,0.3)":"transparent"}`,borderRadius:14,padding:"14px 16px",animation:`fadeIn 0.3s ease ${i*0.08}s both`}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
              <div>
                <div style={{fontSize:12,color:isT?"#fff":"rgba(255,255,255,0.45)",fontWeight:isT?700:400,letterSpacing:1.5,fontFamily:FF}}>{isT?"TODAY":formatDay(d)}</div>
                <div style={{fontSize:13,color:"rgba(255,255,255,0.45)",marginTop:1}}>{wmo.label}</div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:10,color:"rgba(255,255,255,0.25)",marginBottom:2,letterSpacing:1}}>HIGH / LOW</div>
                  <div style={{fontSize:16,fontWeight:800,color:"#fff"}}>{dispMax} <span style={{color:"rgba(255,255,255,0.35)",fontWeight:400}}>/ {dispMin}</span></div>
                </div>
                <div style={{width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center"}}><WeatherIcon code={wc??3} size={28}/></div>
              </div>
            </div>
            <div style={{display:"flex",gap:16,flexWrap:"wrap",alignItems:"center"}}>
              {wind!=null&&<div style={{display:"flex",alignItems:"center",gap:8}}><WindCompass dir={wD||0}/><div><div style={{fontSize:10,color:"rgba(255,255,255,0.3)",letterSpacing:1.5}}>WIND / GUSTS</div><div style={{fontSize:13,fontWeight:600,color:"#fff"}}>{Math.round(wind)} <span style={{color:"rgba(255,255,255,0.4)"}}>↑{gusts?Math.round(gusts):"-"}</span> mph {windDir(wD||0)}</div></div></div>}
              {prec!=null&&<div><div style={{fontSize:10,color:"rgba(255,255,255,0.3)",letterSpacing:1.5}}>PRECIP</div><div style={{fontSize:13,fontWeight:600,color:"#60a5fa"}}>{prec}%</div></div>}
              {sunrise&&<div><div style={{fontSize:10,color:"rgba(255,255,255,0.3)",letterSpacing:1.5}}>DAYLIGHT</div><div style={{fontSize:12,color:"rgba(255,255,255,0.55)"}}>{new Date(sunrise).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})} – {new Date(sunset).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}</div></div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Scotland Map View ─────────────────────────────────────────────────────────
function ScotlandMap({munros,bagged,onSelect}){
  const[hover,setHover]=useState(null);
  const W=400,H=550;
  const minLat=54.6,maxLat=58.75,minLon=-7.0,maxLon=-1.5;
  const proj=(lat,lon)=>[((lon-minLon)/(maxLon-minLon))*W,((maxLat-lat)/(maxLat-minLat))*H];
  // Accurate Scotland mainland coastline traced from OS geographic data
  const COAST="M362.9,394.9 L351.3,381.7 L348.4,371.1 L320.0,364.5 L277.8,357.8 L290.9,338.0 L306.9,320.7 L296.0,303.5 L310.5,302.2 L323.6,291.6 L330.2,270.4 L344.7,262.4 L349.1,237.2 L357.8,213.4 L365.1,188.2 L378.2,165.7 L360.0,140.5 L327.3,139.2 L293.8,141.8 L269.1,145.8 L235.6,152.4 L212.4,165.7 L218.2,152.4 L234.2,140.5 L219.6,119.3 L261.8,103.4 L261.8,79.5 L269.1,67.6 L283.6,46.4 L285.1,41.1 L285.8,19.9 L274.9,10.6 L250.9,15.9 L210.9,25.2 L187.6,33.1 L165.8,23.9 L152.7,30.5 L145.5,19.9 L141.8,26.5 L138.2,46.4 L136.7,66.3 L134.5,79.5 L133.8,92.8 L123.6,99.4 L120.0,106.0 L112.7,112.7 L120.0,119.3 L132.4,112.7 L138.2,121.9 L120.0,123.3 L109.1,132.5 L98.2,136.5 L87.3,129.9 L87.3,145.8 L87.3,155.1 L101.8,159.0 L112.7,152.4 L109.1,159.0 L94.5,176.3 L90.9,194.8 L107.6,196.1 L96.0,201.4 L93.1,212.0 L90.9,225.3 L83.6,238.6 L84.4,251.8 L81.5,265.1 L58.2,274.3 L76.4,284.9 L101.8,295.5 L109.1,291.6 L105.5,298.2 L136.7,274.3 L130.9,278.3 L110.5,298.2 L110.5,308.8 L99.6,318.1 L101.8,331.3 L94.5,344.6 L105.5,353.9 L109.1,364.5 L114.9,377.7 L98.2,384.3 L94.5,404.2 L101.8,440.0 L116.4,430.7 L134.5,410.8 L134.5,397.6 L145.5,384.3 L154.2,371.1 L161.5,375.1 L165.8,383.0 L156.4,391.0 L156.4,417.5 L154.2,444.0 L149.1,470.5 L138.2,510.2 L156.4,536.7 L189.1,520.8 L229.1,516.9 L261.8,503.6 L287.3,497.0 L305.5,483.7 L323.6,450.6 L341.8,424.1 L352.7,410.8Z";
  return(
    <div style={{background:"linear-gradient(180deg,rgba(255,255,255,0.02) 0%,rgba(255,255,255,0.01) 100%)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:16,padding:16,marginBottom:16}}>
      <div style={{fontSize:11,fontWeight:700,letterSpacing:3,color:"rgba(255,255,255,0.5)",marginBottom:12,fontFamily:FF}}>SCOTLAND · ALL 282 MUNROS</div>
      <div style={{position:"relative"}}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",maxWidth:420,display:"block",margin:"0 auto"}}>
          <defs>
            <radialGradient id="mapGlow" cx="50%" cy="40%" r="50%"><stop offset="0%" stopColor="rgba(255,255,255,0.04)"/><stop offset="100%" stopColor="transparent"/></radialGradient>
          </defs>
          {/* Land fill */}
          <path d={COAST} fill="url(#mapGlow)" stroke="none"/>
          <path d={COAST} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.2" strokeLinejoin="round"/>
          {/* Grid lines */}
          {[55,56,57,58].map(lat=>{const y=((maxLat-lat)/(maxLat-minLat))*H;return <line key={lat} x1={0} y1={y} x2={W} y2={y} stroke="rgba(255,255,255,0.03)" strokeWidth="0.5"/>;})}
          {[-6,-5,-4,-3,-2].map(lon=>{const x=((lon-minLon)/(maxLon-minLon))*W;return <line key={lon} x1={x} y1={0} x2={x} y2={H} stroke="rgba(255,255,255,0.03)" strokeWidth="0.5"/>;})}
          {/* Munro dots */}
          {munros.map(m=>{
            const[x,y]=proj(m.lat,m.lon);
            const isBagged=bagged[m.name];
            const isHover=hover===m.name;
            return <circle key={m.name} cx={x} cy={y} r={isHover?5:2.5}
              fill={isBagged?"#22c55e":isHover?"#fff":"rgba(255,255,255,0.45)"}
              stroke={isBagged?"#22c55e44":isHover?"rgba(255,255,255,0.6)":"none"} strokeWidth={isHover?2:0}
              style={{cursor:"pointer",transition:"all .15s"}}
              onClick={()=>onSelect(m)}
              onMouseEnter={()=>setHover(m.name)}
              onMouseLeave={()=>setHover(null)}
            />;
          })}
        </svg>
        {/* Tooltip */}
        {hover&&(()=>{
          const m=munros.find(x=>x.name===hover);if(!m)return null;
          const[x,y]=proj(m.lat,m.lon);
          const isBagged=bagged[m.name];
          return(
            <div style={{position:"absolute",left:`${(x/W)*100}%`,top:`${(y/H)*100}%`,transform:"translate(-50%,-120%)",background:"rgba(0,0,0,0.85)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:8,padding:"6px 10px",pointerEvents:"none",whiteSpace:"nowrap",zIndex:10}}>
              <div style={{fontSize:11,fontWeight:800,color:"#fff",textTransform:"uppercase",letterSpacing:0.5}}>{isBagged&&<span style={{color:"#22c55e"}}>✓ </span>}{m.name}</div>
              <div style={{fontSize:9,color:"rgba(255,255,255,0.5)"}}>{m.height}m · {m.region}</div>
            </div>
          );
        })()}
      </div>
      <div style={{display:"flex",justifyContent:"center",gap:16,marginTop:12}}>
        <div style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:8,height:8,borderRadius:"50%",background:"rgba(255,255,255,0.45)"}}/><span style={{fontSize:10,color:"rgba(255,255,255,0.4)"}}>Not climbed</span></div>
        <div style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:8,height:8,borderRadius:"50%",background:"#22c55e"}}/><span style={{fontSize:10,color:"rgba(255,255,255,0.4)"}}>Bagged</span></div>
        <div style={{fontSize:10,color:"rgba(255,255,255,0.3)"}}>Tap a peak to view</div>
      </div>
    </div>
  );
}

// ─── Detail page ───────────────────────────────────────────────────────────────
function DetailPage({munro,onBack,bagged,onToggleBag}){
  const[data,setData]=useState(null);const[loading,setLoading]=useState(true);
  const[tab,setTab]=useState("hourly");const[showRisk,setShowRisk]=useState(false);const[showMidge,setShowMidge]=useState(false);
  const{useFahrenheit}=useTempUnit();
  useEffect(()=>{setLoading(true);setData(null);setTab("hourly");setShowRisk(false);setShowMidge(false);fetchWeather(munro).then(d=>{setData(d);setLoading(false);});},[munro.name]);
  const cur=data?.current||{};const wmo=WMO[cur.weather_code]||{label:"Unknown",ds:0};
  const risk=calcRisk(cur);const midge=calcMidge(cur,munro.height);
  const g=RISK_GRADIENTS[risk.band];const acc=RISK_ACCENT[risk.band];
  const feelsC=Math.round(cur.apparent_temperature??0);const feelsF=toF(cur.apparent_temperature??0);
  const feelsPri=useFahrenheit?`${feelsF}°F`:`${feelsC}°C`;const feelsSec=useFahrenheit?`${feelsC}°C`:`${feelsF}°F`;
  const isBagged=bagged[munro.name];
  return(
    <div style={{minHeight:"100vh",background:`linear-gradient(170deg,${g[0]} 0%,${g[1]} 30%,${g[2]} 55%,#040406 100%)`,color:"#fff",fontFamily:FF}}>
      <div style={{position:"absolute",top:0,left:0,right:0,height:"40vh",background:`radial-gradient(ellipse at 30% 0%, ${acc}08 0%, transparent 70%)`,pointerEvents:"none"}}/>
      <div style={{position:"relative",display:"flex",justifyContent:"space-between",alignItems:"center",padding:"24px 24px 0"}}>
        <button onClick={onBack} style={{background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.14)",color:"rgba(255,255,255,0.6)",borderRadius:8,padding:"8px 16px",cursor:"pointer",fontSize:11,letterSpacing:2,fontFamily:FF}}>← BACK</button>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <button onClick={()=>onToggleBag(munro.name)} style={{background:isBagged?"rgba(34,197,94,0.15)":"rgba(255,255,255,0.07)",border:`1px solid ${isBagged?"rgba(34,197,94,0.4)":"rgba(255,255,255,0.14)"}`,color:isBagged?"#4ade80":"rgba(255,255,255,0.6)",borderRadius:8,padding:"8px 14px",cursor:"pointer",fontSize:11,letterSpacing:1,fontFamily:FF,fontWeight:600}}>{isBagged?"✓ BAGGED":"+ BAG IT"}</button>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",letterSpacing:3}}>SUMMIT FORECAST</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.2)",marginTop:1}}>{munro.height}m · {munro.region}</div>
          </div>
        </div>
      </div>
      <div style={{position:"relative",padding:"20px 24px 0"}}>
        {loading?<SkeletonLoader/>:data?(
          <>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
              <div><TempDisplay celsius={cur.temperature_2m??0} big style={{marginBottom:6}}/><div style={{fontSize:13,color:"rgba(255,255,255,0.4)",marginBottom:16}}>{wmo.label} · Feels {feelsPri} / {feelsSec}</div></div>
              <div style={{flexShrink:0,display:"flex",flexDirection:"column",alignItems:"center",gap:3,marginTop:6}}>
                <div style={{transform:"scale(1.5)",transformOrigin:"center top",marginBottom:8}}><WindCompass dir={cur.wind_direction_10m||0}/></div>
                <div style={{fontSize:13,fontWeight:800,color:"rgba(255,255,255,0.7)",letterSpacing:0.5}}>{Math.round(cur.wind_speed_10m||0)} mph</div>
                <div style={{fontSize:9,color:"rgba(255,255,255,0.35)",letterSpacing:1.5,fontWeight:600}}>gusts {Math.round(cur.wind_gusts_10m||0)}</div>
              </div>
            </div>
            <div style={{marginBottom:16}}>
              <RiskBar band={risk.band} score={risk.score} large/>
              <button onClick={()=>setShowRisk(v=>!v)} style={{marginTop:8,background:"none",border:"none",color:acc,fontSize:11,cursor:"pointer",letterSpacing:1,padding:0,fontWeight:600,fontFamily:FF}}>{showRisk?"▲ HIDE RISK BREAKDOWN":"▼ HOW IS RISK CALCULATED?"}</button>
              {showRisk&&<RiskBreakdown detail={risk.detail}/>}
            </div>
            <div style={{marginBottom:16}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                <div style={{background:`${midge.color||"#555"}15`,borderRadius:8,padding:4,display:"flex"}}><MidgeIcon size={18} color={midge.color||"#555"}/></div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:700,color:"#fff",letterSpacing:0.5,fontFamily:FF}}>MIDGE ACTIVITY: <span style={{color:midge.color}}>{midge.level}/5</span></div>
                  <div style={{fontSize:10,color:"rgba(255,255,255,0.5)",marginTop:1}}>{midge.desc}</div>
                </div>
                <div style={{display:"flex",gap:2,flexShrink:0}}>{[1,2,3,4,5].map(i=><div key={i} style={{width:6,height:6,borderRadius:3,background:i<=midge.level?(midge.color||"#555"):"rgba(255,255,255,0.1)"}}/>)}</div>
              </div>
              <button onClick={()=>setShowMidge(v=>!v)} style={{background:"none",border:"none",color:midge.color||"#888",fontSize:11,cursor:"pointer",letterSpacing:1,padding:0,fontWeight:600,fontFamily:FF}}>{showMidge?"▲ HIDE MIDGE BREAKDOWN":"▼ HOW IS MIDGE LEVEL CALCULATED?"}</button>
              {showMidge&&<MidgePanel wx={cur} height={munro.height}/>}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:16}}>
              {[{label:"WIND",value:`${Math.round(cur.wind_speed_10m||0)}`,unit:"mph"},{label:"GUSTS",value:`${Math.round(cur.wind_gusts_10m||0)}`,unit:"mph"},{label:"HUMIDITY",value:`${cur.relative_humidity_2m||0}`,unit:"%"},{label:"PRESSURE",value:`${Math.round(cur.surface_pressure||0)}`,unit:"hPa"}].map(s=>(
                <div key={s.label} style={{background:"linear-gradient(145deg,rgba(255,255,255,0.07) 0%,rgba(255,255,255,0.02) 100%)",border:"1px solid rgba(255,255,255,0.09)",borderRadius:12,padding:"11px 8px",textAlign:"center"}}>
                  <div style={{fontSize:9,color:"rgba(255,255,255,0.35)",letterSpacing:1.5,marginBottom:4}}>{s.label}</div>
                  <div style={{fontSize:16,fontWeight:800,color:"#fff"}}>{s.value}<span style={{fontSize:10,fontWeight:400,color:"rgba(255,255,255,0.35)"}}>{s.unit}</span></div>
                </div>
              ))}
            </div>
          </>
        ):<div style={{textAlign:"center",padding:60,color:"rgba(255,255,255,0.3)"}}>No data available</div>}
      </div>
      <div style={{padding:"0 24px"}}>
        <h1 style={{fontSize:munro.name.length>16?18:26,fontWeight:900,margin:"0 0 2px",letterSpacing:2,color:"rgba(255,255,255,0.9)",fontFamily:FFS,textTransform:"uppercase"}}>{munro.name}</h1>
        <div style={{fontSize:11,color:"rgba(255,255,255,0.28)",letterSpacing:2,marginBottom:8}}>{munro.height}m ABOVE SEA LEVEL</div>
        <div style={{height:130,width:"100%"}}><MountainSVG name={munro.name} w={500} h={130} accent={acc+"cc"}/></div>
      </div>
      {data&&<>
        <div style={{display:"flex",padding:"12px 24px 14px"}}>{[["hourly","HOURLY"],["days","4-DAY OUTLOOK"]].map(([k,l])=><button key={k} onClick={()=>setTab(k)} style={{flex:1,padding:"10px 0",background:tab===k?"rgba(255,255,255,0.12)":"transparent",border:"1px solid rgba(255,255,255,0.1)",borderRadius:k==="hourly"?"10px 0 0 10px":"0 10px 10px 0",color:tab===k?"#fff":"rgba(255,255,255,0.35)",fontSize:11,letterSpacing:2,cursor:"pointer",fontWeight:tab===k?700:400,fontFamily:FF}}>{l}</button>)}</div>
        <div style={{padding:"0 24px 60px"}}>{tab==="hourly"?<HourlyStrip hourly={data.hourly} current={data.current}/>:<DailyForecast daily={data.daily}/>}</div>
      </>}
    </div>
  );
}

// ─── Munro card ────────────────────────────────────────────────────────────────
function MunroCardWithCallback({munro,onClick,onWeatherLoaded,bagged}){
  const[wx,setWx]=useState(null);const{useFahrenheit}=useTempUnit();
  useEffect(()=>{fetchWeather(munro).then(d=>{setWx(d?.current);if(onWeatherLoaded&&d?.current)onWeatherLoaded(munro.name,d.current);}).catch(()=>{});},[]);
  const risk=calcRisk(wx);const g=RISK_GRADIENTS[risk.band];const acc=RISK_ACCENT[risk.band];
  const dispTemp=wx?(useFahrenheit?`${toF(wx.temperature_2m)}°F`:`${Math.round(wx.temperature_2m)}°C`):null;
  const secTemp=wx?(useFahrenheit?`${Math.round(wx.temperature_2m)}°C`:`${toF(wx.temperature_2m)}°F`):null;
  const isBagged=bagged[munro.name];
  return(
    <div onClick={onClick}
      style={{background:`linear-gradient(135deg,${g[0]} 0%,${g[1]} 100%)`,border:`1px solid ${acc}33`,borderRadius:14,padding:"12px 16px",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",transition:"all .2s",boxShadow:"0 0 0 0 transparent"}}
      onMouseEnter={e=>{e.currentTarget.style.transform="scale(1.01)";e.currentTarget.style.boxShadow=`0 0 20px ${acc}15`;}}
      onMouseLeave={e=>{e.currentTarget.style.transform="scale(1)";e.currentTarget.style.boxShadow="0 0 0 0 transparent";}}>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",alignItems:"center",gap:4}}>
          {isBagged&&<div style={{width:6,height:6,borderRadius:3,background:"#22c55e",flexShrink:0}}/>}
          <div style={{fontSize:9,color:"rgba(255,255,255,0.55)",letterSpacing:2}}>{munro.region.toUpperCase()}</div>
        </div>
        <div style={{fontSize:14,fontWeight:800,color:"#fff",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",fontFamily:FFS,textTransform:"uppercase",letterSpacing:0.5}}>{munro.name}</div>
        <div style={{fontSize:10,color:"rgba(255,255,255,0.55)"}}>{munro.height}m</div>
      </div>
      <div style={{width:80,height:40,opacity:.5,flexShrink:0,margin:"0 12px"}}><MountainSVG name={munro.name} w={80} h={40} mini accent={acc+"99"}/></div>
      <div style={{textAlign:"right",flexShrink:0}}>
        {wx?<><div style={{fontSize:20,fontWeight:900,color:"#fff"}}>{dispTemp}</div><div style={{fontSize:11,color:"rgba(255,255,255,0.6)"}}>{secTemp}</div><RiskBar band={risk.band} score={risk.score}/><MidgeBadge wx={wx} height={munro.height}/></>:<SkeletonLoader type="card"/>}
      </div>
    </div>
  );
}

// ─── Hero card ─────────────────────────────────────────────────────────────────
function HeroCard({munro,onDetail,showRisk,onToggleRisk}){
  const[wx,setWx]=useState(null);const[loading,setLoading]=useState(true);const[showMidge,setShowMidge]=useState(false);
  const{useFahrenheit,toggle}=useTempUnit();
  useEffect(()=>{setLoading(true);fetchWeather(munro).then(d=>{setWx(d?.current);setLoading(false);});},[munro.name]);
  const wmo=wx?(WMO[wx.weather_code]||{label:"Unknown"}):null;
  const risk=calcRisk(wx);const midge=calcMidge(wx,munro.height);
  const g=RISK_GRADIENTS[risk.band];const acc=RISK_ACCENT[risk.band];
  const pri=wx?(useFahrenheit?`${toF(wx.temperature_2m)}°F`:`${Math.round(wx.temperature_2m)}°C`):null;
  const sec=wx?(useFahrenheit?`${Math.round(wx.temperature_2m)}°C`:`${toF(wx.temperature_2m)}°F`):null;
  const feelsPri=wx?(useFahrenheit?`${toF(wx.apparent_temperature??0)}°F`:`${Math.round(wx.apparent_temperature??0)}°C`):null;
  return(
    <div style={{background:`linear-gradient(160deg,${g[0]} 0%,${g[1]} 55%,${g[2]} 100%)`,borderRadius:20,overflow:"hidden",marginBottom:0,position:"relative"}}>
      <div style={{padding:"22px 22px 0"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
          <div>
            <div style={{fontSize:10,letterSpacing:4,color:"rgba(255,255,255,0.55)",textTransform:"uppercase",marginBottom:3,fontFamily:FF}}>Today's Summit</div>
            <h2 style={{fontSize:munro.name.length>16?16:22,fontWeight:900,margin:"0 0 2px",letterSpacing:1.5,fontFamily:FFS,textTransform:"uppercase"}}>{munro.name}</h2>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.65)"}}>{munro.height}m · {munro.region}</div>
          </div>
          <button onClick={onDetail} style={{background:"rgba(255,255,255,0.12)",border:`1px solid ${acc}88`,color:"#fff",borderRadius:10,padding:"9px 16px",cursor:"pointer",fontSize:12,letterSpacing:1,fontWeight:600,flexShrink:0,fontFamily:FF}}>DETAIL →</button>
        </div>
        {loading?<SkeletonLoader/>:wx?<>
          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
            <div style={{cursor:"pointer",userSelect:"none"}} onClick={toggle}>
              <div style={{fontSize:92,fontWeight:900,color:"#fff",letterSpacing:-5,lineHeight:1,textShadow:"0 0 80px rgba(255,255,255,0.25)",fontFamily:FF}}>{pri}</div>
              <div style={{display:"flex",alignItems:"baseline",gap:8,marginTop:4}}>
                <div style={{fontSize:24,fontWeight:700,color:"rgba(255,255,255,0.65)",letterSpacing:-1}}>{sec}</div>
                <div style={{fontSize:14,color:"rgba(255,255,255,0.8)",letterSpacing:2,textTransform:"uppercase",fontWeight:600}}>{wmo?.label}</div>
              </div>
            </div>
            <div style={{flexShrink:0,display:"flex",flexDirection:"column",alignItems:"center",gap:3,marginTop:8}}>
              <div style={{transform:"scale(1.5)",transformOrigin:"center top",marginBottom:8}}><WindCompass dir={wx.wind_direction_10m||0}/></div>
              <div style={{fontSize:13,fontWeight:800,color:"rgba(255,255,255,0.7)",letterSpacing:0.5}}>{Math.round(wx.wind_speed_10m||0)} mph</div>
              <div style={{fontSize:9,color:"rgba(255,255,255,0.35)",letterSpacing:1.5,fontWeight:600}}>gusts {Math.round(wx.wind_gusts_10m||0)}</div>
            </div>
          </div>
          <div style={{fontSize:10,letterSpacing:1.5,color:"rgba(255,255,255,0.45)",textTransform:"uppercase",marginTop:6,marginBottom:8,fontFamily:FF}}>tap temperature to swap °C / °F</div>
          <div style={{fontSize:13,color:"rgba(255,255,255,0.7)",marginBottom:10}}>Feels {feelsPri} · Gusts {Math.round(wx.wind_gusts_10m||0)} mph</div>
          <RiskBar band={risk.band} score={risk.score} large/>
          <button onClick={onToggleRisk} style={{marginTop:8,marginBottom:4,background:"none",border:"none",color:acc,fontSize:11,cursor:"pointer",letterSpacing:1,padding:0,fontWeight:600,fontFamily:FF}}>{showRisk?"▲ HIDE RISK BREAKDOWN":"▼ HOW IS RISK CALCULATED?"}</button>
          {showRisk&&<RiskBreakdown detail={risk.detail}/>}
          <div style={{marginTop:14}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{background:`${midge.color||"#555"}15`,borderRadius:8,padding:5,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><MidgeIcon size={18} color={midge.color||"#555"}/></div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:700,color:"#fff",letterSpacing:0.5,fontFamily:FF}}>MIDGE ACTIVITY: <span style={{color:midge.color||"#555"}}>{midge.level}/5</span></div>
                <div style={{fontSize:10,color:"rgba(255,255,255,0.5)",marginTop:1}}>{midge.desc}</div>
              </div>
              <div style={{display:"flex",gap:2,flexShrink:0}}>{[1,2,3,4,5].map(i=><div key={i} style={{width:6,height:6,borderRadius:3,background:i<=midge.level?(midge.color||"#555"):"rgba(255,255,255,0.1)"}}/>)}</div>
            </div>
            <button onClick={()=>setShowMidge(v=>!v)} style={{marginTop:8,background:"none",border:"none",color:midge.color||"#888",fontSize:11,cursor:"pointer",letterSpacing:1,padding:0,fontWeight:600,fontFamily:FF}}>{showMidge?"▲ HIDE MIDGE BREAKDOWN":"▼ HOW IS MIDGE LEVEL CALCULATED?"}</button>
            {showMidge&&<MidgePanel wx={wx} height={munro.height}/>}
          </div>
        </>:null}
      </div>
      <div style={{height:130,marginTop:14,position:"relative"}}>
        <MountainSVG name={munro.name} w={500} h={130} accent={wx?acc+"cc":"rgba(255,255,255,0.55)"}/>
        <FogOverlay/>
      </div>
    </div>
  );
}

// ─── Search bar ────────────────────────────────────────────────────────────────
function SearchBar({value,onChange,onClear}){
  return(
    <div style={{position:"relative",marginBottom:20}}>
      <div style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",color:"rgba(255,255,255,0.3)",fontSize:15,pointerEvents:"none"}}>⌕</div>
      <input value={value} onChange={e=>onChange(e.target.value)} placeholder="Search all 282 Munros…"
        style={{width:"100%",background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",color:"#fff",borderRadius:14,padding:"13px 42px 13px 40px",fontSize:15,outline:"none",boxSizing:"border-box",letterSpacing:0.2,fontFamily:FF}}/>
      {value&&<button onClick={onClear} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"rgba(255,255,255,0.12)",border:"none",color:"rgba(255,255,255,0.6)",borderRadius:"50%",width:22,height:22,cursor:"pointer",fontSize:12,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>}
    </div>
  );
}

// ─── App ───────────────────────────────────────────────────────────────────────
export default function App(){
  const[page,setPage]=useState("home");const[selected,setSelected]=useState(null);
  const[search,setSearch]=useState("");const[regionFilter,setRegionFilter]=useState("All");
  const[sortOrder,setSortOrder]=useState("alpha");const[munroWeather,setMunroWeather]=useState({});
  const[showHeroRisk,setShowHeroRisk]=useState(false);
  const[useFahrenheit,setUseFahrenheit]=useState(false);
  const[heroMunro]=useState(()=>MUNROS[Math.floor(Math.random()*MUNROS.length)]);
  const[bagged,setBagged]=useState(loadBagged);
  const[view,setView]=useState("list"); // "list" | "map"
  const theme=getTimeTheme();

  const toggleUnit=()=>setUseFahrenheit(v=>!v);
  const tempCtx={useFahrenheit,toggle:toggleUnit};
  const open=(m,src)=>{setSelected({...m,_src:src});setPage("detail");};
  const toggleBag=(name)=>{setBagged(prev=>{const next={...prev};if(next[name])delete next[name];else next[name]=Date.now();saveBagged(next);return next;});};
  const regions=["All",...[...new Set(MUNROS.map(m=>m.region))].sort()];
  const onWeatherLoaded=(name,wx)=>{setMunroWeather(prev=>({...prev,[name]:calcRisk(wx)}));};
  const bagCount=Object.keys(bagged).length;

  const baseMunros=search.length>0?MUNROS.filter(m=>m.name.toLowerCase().includes(search.toLowerCase())||m.region.toLowerCase().includes(search.toLowerCase())):[...MUNROS];
  const sortedMunros=[...baseMunros].sort((a,b)=>{
    if(sortOrder==="risk"){const ra=munroWeather[a.name]?.band??-1,rb=munroWeather[b.name]?.band??-1;if(ra!==rb)return rb-ra;}
    if(sortOrder==="region"){const rc=a.region.localeCompare(b.region);if(rc!==0)return rc;}
    return a.name.localeCompare(b.name);
  });
  const filteredMunros=regionFilter==="All"?sortedMunros:sortedMunros.filter(m=>m.region===regionFilter);

  if(page==="detail"&&selected)return(<TempUnitCtx.Provider value={tempCtx}><DetailPage munro={selected} onBack={()=>{setPage("home");setSelected(null);}} bagged={bagged} onToggleBag={toggleBag}/></TempUnitCtx.Provider>);

  return(
    <TempUnitCtx.Provider value={tempCtx}>
      <div style={{minHeight:"100vh",background:theme.bg,color:"#fff",fontFamily:FF}}>
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:theme.tint,pointerEvents:"none",zIndex:0}}/>
        <div style={{position:"relative",zIndex:1,maxWidth:600,margin:"0 auto",padding:"28px 20px 60px"}}>

          <div style={{marginBottom:20}}>
            <div style={{fontSize:10,letterSpacing:4,color:"rgba(255,255,255,0.5)",textTransform:"uppercase",marginBottom:4}}>Scotland · {MUNROS.length} Munros</div>
            <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between"}}>
              <h1 style={{fontSize:28,fontWeight:900,margin:0,letterSpacing:2,fontFamily:FFS,textTransform:"uppercase"}}>Summit Forecasts</h1>
              {bagCount>0&&<div style={{fontSize:11,color:"#22c55e",fontWeight:700}}>{bagCount}/282 bagged</div>}
            </div>
          </div>

          <SearchBar value={search} onChange={setSearch} onClear={()=>setSearch("")}/>

          {search.length>0&&(
            <div style={{marginBottom:16,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:16,overflow:"hidden",maxHeight:400,overflowY:"auto",scrollbarWidth:"thin"}}>
              <div style={{padding:"10px 14px 6px",fontSize:9,letterSpacing:2,color:"rgba(255,255,255,0.35)"}}>{filteredMunros.length} RESULT{filteredMunros.length!==1?"S":""}</div>
              {filteredMunros.length===0?<div style={{textAlign:"center",padding:"20px",color:"rgba(255,255,255,0.3)",fontSize:13}}>No munros match "{search}"</div>:(
                <div style={{display:"flex",flexDirection:"column"}}>
                  {filteredMunros.slice(0,15).map(m=>{const isBagged=bagged[m.name];return(
                    <div key={m.name} onClick={()=>{open(m,"home");setSearch("");}} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",cursor:"pointer",borderBottom:"1px solid rgba(255,255,255,0.04)",transition:"background .15s"}}
                      onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.06)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                      <div style={{display:"flex",alignItems:"center",gap:6,minWidth:0}}>
                        {isBagged&&<div style={{width:6,height:6,borderRadius:3,background:"#22c55e",flexShrink:0}}/>}
                        <div><div style={{fontSize:13,fontWeight:800,color:"#fff",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",fontFamily:FFS,textTransform:"uppercase",letterSpacing:0.5}}>{m.name}</div><div style={{fontSize:10,color:"rgba(255,255,255,0.4)"}}>{m.height}m · {m.region}</div></div>
                      </div>
                      <div style={{fontSize:11,color:"rgba(255,255,255,0.25)",flexShrink:0,marginLeft:8}}>→</div>
                    </div>
                  );})}
                  {filteredMunros.length>15&&<div style={{padding:"8px 14px",fontSize:10,color:"rgba(255,255,255,0.3)",textAlign:"center"}}>+{filteredMunros.length-15} more — refine your search</div>}
                </div>
              )}
            </div>
          )}

          {search.length===0&&<HeroCard munro={heroMunro} onDetail={()=>open(heroMunro,"home")} showRisk={showHeroRisk} onToggleRisk={()=>setShowHeroRisk(v=>!v)}/>}

          <div style={{marginTop:28,marginBottom:14}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
              <div style={{display:"flex",alignItems:"baseline",gap:8}}>
                <div style={{fontSize:11,fontWeight:700,letterSpacing:3,color:"rgba(255,255,255,0.7)"}}>ALL MUNROS</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>{filteredMunros.length}</div>
              </div>
              <div style={{display:"flex",gap:0}}>
                {[["list","LIST"],["map","MAP"]].map(([k,l],i,arr)=>(
                  <button key={k} onClick={()=>setView(k)} style={{padding:"6px 12px",background:view===k?"rgba(255,255,255,0.16)":"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:i===0?"8px 0 0 8px":"0 8px 8px 0",color:view===k?"#fff":"rgba(255,255,255,0.5)",fontSize:10,letterSpacing:1,cursor:"pointer",fontWeight:view===k?700:400}}>{l}</button>
                ))}
              </div>
            </div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
              <div style={{display:"flex",gap:0}}>
                {[["alpha","A–Z"],["risk","RISK"],["region","REGION"]].map(([k,l],i,arr)=>(
                  <button key={k} onClick={()=>setSortOrder(k)} style={{padding:"6px 12px",background:sortOrder===k?"rgba(255,255,255,0.16)":"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:i===0?"8px 0 0 8px":i===arr.length-1?"0 8px 8px 0":"0",color:sortOrder===k?"#fff":"rgba(255,255,255,0.5)",fontSize:10,letterSpacing:1,cursor:"pointer",fontWeight:sortOrder===k?700:400}}>{l}</button>
                ))}
              </div>
            </div>
            <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:6,scrollbarWidth:"none"}}>
              {regions.map(r=><button key={r} onClick={()=>setRegionFilter(r)} style={{flexShrink:0,background:regionFilter===r?"rgba(255,255,255,0.14)":"rgba(255,255,255,0.04)",border:`1px solid ${regionFilter===r?"rgba(255,255,255,0.3)":"rgba(255,255,255,0.09)"}`,borderRadius:8,padding:"5px 12px",color:regionFilter===r?"#fff":"rgba(255,255,255,0.5)",fontSize:10,cursor:"pointer",whiteSpace:"nowrap",fontWeight:regionFilter===r?700:400}}>{r}</button>)}
            </div>
          </div>

          <div style={{display:"flex",gap:12,marginBottom:14,flexWrap:"wrap"}}>
            {RISK_LABELS.map((l,i)=><div key={l} style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:8,height:8,borderRadius:"50%",background:RISK_ACCENT[i]}}/><span style={{fontSize:11,color:"rgba(255,255,255,0.55)"}}>{l}</span></div>)}
          </div>

          {view==="map"?<ScotlandMap munros={MUNROS} bagged={bagged} onSelect={m=>open(m,"home")}/>:null}

          {view==="list"&&(filteredMunros.length===0?(
            <div style={{textAlign:"center",padding:"40px 20px",color:"rgba(255,255,255,0.4)"}}>
              <div style={{fontSize:32,marginBottom:12}}>⛰</div><div style={{fontSize:14}}>No munros found</div>
            </div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:9}}>
              {filteredMunros.map(m=><MunroCardWithCallback key={m.name} munro={m} onClick={()=>open(m,"home")} onWeatherLoaded={onWeatherLoaded} bagged={bagged}/>)}
            </div>
          ))}

        </div>
      </div>
    </TempUnitCtx.Provider>
  );
}
