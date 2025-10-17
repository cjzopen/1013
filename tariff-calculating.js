const pointPopover = document.getElementById('pointPopover');
const popoverBtn = document.querySelector('#pointPopoverToggle');

// 從 localStorage 讀取或使用預設值
const tariffRates = JSON.parse(localStorage.getItem('tariffRates')) || {
  '柬埔寨': 19,
  '泰國': 19,
  '臺灣': 20,
  '越南': 20,
  '中國': 30
};

// 儲存關稅資料到 localStorage
function saveTariffRates() {
  localStorage.setItem('tariffRates', JSON.stringify(tariffRates));
}

// DOM
const originInput = document.getElementById('originInput');
const partInput = document.getElementById('partInput');
const costInput = document.getElementById('costInput');
const priceInput = document.getElementById('priceInput');
const amountInput = document.getElementById('amountInput');
const btnAdd = document.getElementById('btnAdd');
const btnClear = document.getElementById('btnClear');
const listEl = document.getElementById('list');
// const countryEditor = document.getElementById('countryEditor');
const newCountryForm = document.getElementById('newCountryForm');
const newCountryName = document.getElementById('newCountryName');
const newCountryTariff = document.getElementById('newCountryTariff');
const btnStart = document.getElementById('btnStart');
// const btnReset = document.getElementById('btnReset');
const chartRow = document.getElementById('chartRow');


// 將預設國家載入下拉與右側編輯區
let selectedOrigin = null; // 當前選取的國家

function renderCountryUI() {
  // originInput 現在是按鈕群容器
  originInput.innerHTML = '';

  Object.keys(tariffRates).forEach((c, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-outline-warning m-1';
    btn.textContent = `${c} ${tariffRates[c]}%`;
    btn.dataset.name = c;
    btn.onclick = () => {
      // 切換選取狀態
      selectedOrigin = c;
      // 樣式切換
      originInput.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    };
    originInput.appendChild(btn);

    // 預設選第一個
    if (idx === 0 && selectedOrigin === null) {
      selectedOrigin = c;
      // 稍後手動加上 active
      setTimeout(() => btn.classList.add('active'), 0);
    }
  });
}

renderCountryUI();


// 預設隱藏象限統計與圖表區
chartRow.classList.add('d-none');


// 點擊「開始計算」
btnStart.onclick = () => {
  chartRow.classList.remove('d-none');
  // 檢查有無錯誤（這裡假設只要能顯示 chartRow 就算沒錯誤）
  const result = document.getElementById('the-result');
  if (result) {
    setTimeout(() => {
      result.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 200);
  }
};

// 點擊「回復預設」隱藏
// btnReset.onclick = () => {
//   chartRow.classList.add('d-none');
// };


let items = []; // 每筆: { id, part, origin, cost, price, amount, tariff, costWithTariff, marginOriginal, marginAfter }


// Chart.js 初始
const ctx = document.getElementById('chartCanvas').getContext('2d');

// 變大變小
const pulsePlugin = {
  id: 'pulse',
  beforeDraw(chart, args, options) {
    const meta = chart.getDatasetMeta(0);
    if (!meta?.data?.length) return;

    const ctx = chart.ctx;
    const t = Date.now() / 500; // 控制速度
    const scale = 1 + 0.4 * Math.sin(t); // 放大倍率

    meta.data.forEach((point) => {
      if (!point.options._baseRadius) point.options._baseRadius = point.options.radius || 6;
      const r = point.options._baseRadius * scale;
      const { x, y } = point;
      const color = point.options.backgroundColor;

      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.restore();
    });

    // 動畫重繪
    if (!chart._pulseAnimating) {
      chart._pulseAnimating = true;
      const draw = () => {
        chart.draw();
        requestAnimationFrame(draw);
      };
      requestAnimationFrame(draw);
    }
  }
};
Chart.register(pulsePlugin);
const chart = new Chart(ctx, {
  type: 'scatter',
  data: {
    datasets: [
      { label: 'items', data: [], pointRadius: 6, backgroundColor: [] }, // 0 = points
      { label: 'avgXline', data: [], type: 'line', borderColor: '#999', borderDash: [6,4], pointRadius: 0, tension: 0 }, // 1 = 垂直線
      { label: 'avgYline', data: [], type: 'line', borderColor: '#999', borderDash: [6,4], pointRadius: 0, tension: 0 }  // 2 = 水平線
    ]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'nearest', intersect: true },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const d = ctx.raw;
            // 如果是線，直接顯示空字串
            if (!d || d.__line) return '';
            // return `${d.part} | 產地:${d.origin} | 關稅:${d.tariff}% | 成本:${d.cost} | 售價:${d.price} | 銷售額:${d.amount} | 原毛利:${d.marginOriginal}% | 關稅後:${d.marginAfter}%`;
            return `${d.part} | 點擊查看詳細資訊`;
          }
        }
      }
    },
    scales: {
      x: { title: { display: true, text: '銷售金額' }, beginAtZero: false },
      y: { title: { display: true, text: '關稅後毛利率 (%)' } }
    }
  },
  plugins: [pulsePlugin]
});

chartCanvas.addEventListener('click', function (evt) {
  const points = chart.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, true);
  if (points && points.length > 0) {
    const point = points[0];
      if (point.datasetIndex === 0) {
        // 取得平均值
        const avgAmount = items.reduce((s,i)=>s+i.amount,0)/items.length;
        const avgMargin = items.reduce((s,i)=>s+Number(i.marginAfter),0)/items.length;
        // 取得完整資料（用 id 比對）
        const data = chart.data.datasets[point.datasetIndex].data[point.index];
        const item = items.find(it => it.id === data.id) || data;
        let quadrant = '';
        if (item.amount >= avgAmount && item.marginAfter >= avgMargin) quadrant = `<p>哇！太棒了！<br>這產品_(物料編號)_為企業主力產品區段，具穩定訂單與良好毛利，是維持整體獲利的關鍵群組。</p><p>建議持續強化 製程穩定性與供應鏈韌性，確保能在關稅或原物料波動時維持競爭力。同時可評估是否能透過 模組化設計、料件共用化或延伸應用場域，進一步擴大市場規模與產能效益。</p><p>想知道轉移到哪些產地會有更穩地的收益、或是拆解供應鏈中成本分析，歡迎免費申請體驗。</p><div class="px-3 mt-2"><a href="#FormTemplate" style="font-size:20px" class="w-100 btn py-2 bg-orange text-white">立即申請免費AI關稅決策情境模擬 →</a></div>`;
        else if (item.amount < avgAmount && item.marginAfter >= avgMargin) quadrant = `<p>您在第二象限的產品 ${item.part}，說明該產品利潤能力已經成熟，只是銷售規模還沒放大。</p><p>這正是未來的發展機會！<br>若能結合 跨境市場開發、專案式行銷推進，甚至利用 數據化工具精準鎖定需求，就能讓這些產品逐步晉升到第一象限，成為您/企業名重要的營收與利潤引擎。</p><p>針對產品 ${item.part}，建議從……</p><div class="px-3 mt-2"><a href="#FormTemplate" style="font-size:20px" class="w-100 btn py-2 bg-orange text-white">看更多產品分析，歡迎申請免費AI體驗 →</a></div>`;
        else if (item.amount < avgAmount && item.marginAfter < avgMargin) quadrant = `<p>這產品_(物料編號)_暫時處於低量低利區段，可能是製程成本過高或市場需求減弱。建議盤點料件與生產模式，找出可優化的環節，避免資源被低效產品占用。</p><p>建議優先檢視製程成本、原物料替代性與訂單穩定度，評估是否能透過：</p><ul class="disc"><li>改善製造流程、提升稼動率或導入自動化，降低單位成本。</li><li>與關鍵客戶協商改變供應模式，提升訂單量。</li></ul><p>若該產品長期獲利性低，建議逐步縮減資源配置，將產線調整至毛利較佳品項。</p>`;
        else quadrant = `<p>雖然目前您的產品 ${item.part} 集中於<strong>高銷售但低毛利</strong>的第四象限，但這也代表它們具有市場規模優勢！</p><p>只要進一步優化成本結構（如原料、供應鏈）或提升附加價值（如品牌溢價、產品升級），這些產品就能從薄利多銷，轉變為高毛利高銷售的第一象限明星產品。</p><p>針對產品_(物料編號)_，建議從……</p>`;
        // 組內容（只更新內容區）
        const content = `
          <div class="card p-3 mb-3" style="background-color:#FFFEED;border:1px solid #FEE867">
            <div class="meta mb-2">&gt;物料基本資料</div>
            <div class="h4">${item.part} (${item.origin})</div>
            <div class='meta'>成本：${item.cost}，售價：${item.price}，銷售額：${item.amount}</div>
            <div class='meta'>關稅：${item.tariff}% → 到岸成本：${item.costWithTariff}，原毛利：${item.marginOriginal}% ，關稅後：${item.marginAfter}%</div>
          </div>
          ${quadrant}
        `;
        document.getElementById('pointPopoverContent').innerHTML = content;
        // 只觸發 popover 按鈕
        popoverBtn?.click();
      }
  }
});    

    // 新增一筆資料（按鈕）
    btnAdd.onclick = () => {
      const part = partInput.value.trim();
      // 以 selectedOrigin 為主，若表單有輸入 newCountryName 則同時新增國家
      let origin = selectedOrigin;
      const cost = Number(costInput.value);
      const price = Number(priceInput.value);
      const amount = Number(amountInput.value);

      // 若使用者在新增國家表單填了名稱，則在送出時一起新增國家
      const newName = newCountryName.value.trim();
      if (newName) {
        const newTariff = parseFloat(newCountryTariff.value);
        if (isNaN(newTariff)) return alert('請輸入有效的關稅率');
        if (tariffRates[newName] !== undefined) return alert('此國家已存在');
        tariffRates[newName] = newTariff;
        saveTariffRates();
        renderCountryUI();
        origin = newName;
        selectedOrigin = newName;
        // 清空新增欄位
        newCountryName.value = '';
        newCountryTariff.value = '';
      }

      const tariff = tariffRates[origin] ?? 0;

      if (!part) return alert('請輸入料件編號');
      if (!origin) return alert('請選擇產地');
      if (!cost || !price || !amount) return alert('成本/售價/銷售金額都要填寫且大於 0');

      // 計算邏輯
      const costWithTariff = cost * (1 + tariff / 100);
      const marginOriginal = ((price - cost) / price) * 100;
      const marginAfter = ((price - costWithTariff) / price) * 100;

      const item = {
        id: Date.now(),
        part, origin, cost, price, amount,
        tariff,
        costWithTariff: Number(costWithTariff.toFixed(4)),
        marginOriginal: Number(marginOriginal.toFixed(2)),
        marginAfter: Number(marginAfter.toFixed(2))
      };

      items.unshift(item);
      updateAll();
      // 重置表單（保留產地與關稅可視需要）
      partInput.value = '';
      costInput.value = '';
      priceInput.value = '';
      amountInput.value = '';
    };

    // 清空
    btnClear.onclick = () => {
      if (!confirm('確定要清空所有資料？')) return;
      items = [];
      updateAll();
    };

    // 更新圖表、列表、統計
    function updateAll() {
      renderList();
      updateChart();
      updateCounts();
    }

    function renderList() {
      listEl.innerHTML = '';
      if (!items.length) {
        listEl.innerHTML = '<div class="meta">尚無資料</div>';
        return;
      }
      items.forEach((it) => {
        const div = document.createElement('div');
        div.className = 'item';
        div.innerHTML = `
          <div class="d-flex justify-content-between align-items-center">
            <div>
              <div class="fw-bold">${it.part} <span class="meta">(${it.origin})</span></div>
              <div class="meta">成本：${it.cost}，售價：${it.price}，銷售額：${it.amount}</div>
              <div class="meta">關稅：${it.tariff}% → 到岸成本：${it.costWithTariff}，原毛利：${it.marginOriginal}%，關稅後：${it.marginAfter}%</div>
            </div>
            <div style="display:flex;flex-direction:column;gap:6px">
              <button data-id="${it.id}" class="btnDel btn btn-outline-warning">刪除</button>
            </div>
          </div>
        `;
        listEl.appendChild(div);
      });

      // 綁刪除
      listEl.querySelectorAll('.btnDel').forEach(btn => {
        btn.onclick = () => {
          const id = Number(btn.getAttribute('data-id'));
          items = items.filter(x => x.id !== id);
          updateAll();
        };
      });
    }

    function updateCounts() {
      const cnt = { Q1:0, Q2:0, Q3:0, Q4:0 };
      if (!items.length) {
        ['q1','q2','q3','q4'].forEach(id=>document.getElementById(id).textContent = '0');
        return;
      }
      const avgAmount = items.reduce((s,i)=>s+i.amount,0)/items.length;
      const avgMargin = items.reduce((s,i)=>s+Number(i.marginAfter),0)/items.length;

      items.forEach(it => {
        if (it.amount >= avgAmount && it.marginAfter >= avgMargin) cnt.Q1++;
        else if (it.amount < avgAmount && it.marginAfter >= avgMargin) cnt.Q2++;
        else if (it.amount < avgAmount && it.marginAfter < avgMargin) cnt.Q3++;
        else cnt.Q4++;
      });

      document.getElementById('q1').textContent = String(cnt.Q1);
      document.getElementById('q2').textContent = String(cnt.Q2);
      document.getElementById('q3').textContent = String(cnt.Q3);
      document.getElementById('q4').textContent = String(cnt.Q4);
    }

    function updateChart() {
      // 若無資料，清空圖表
      if (!items.length) {
        chart.data.datasets[0].data = [];
        chart.data.datasets[0].backgroundColor = [];
        chart.data.datasets[1].data = [];
        chart.data.datasets[2].data = [];
        chart.update();
        return;
      }

      // 平均值（作為分界）
      const avgAmount = items.reduce((s,i)=>s+i.amount,0)/items.length;
      const avgMargin = items.reduce((s,i)=>s+Number(i.marginAfter),0)/items.length;

      // 計算 x (amount) 與 y (marginAfter) 的範圍，並給一點 padding
      const amounts = items.map(i=>i.amount);
      const margins = items.map(i=>i.marginAfter);
      let minX = Math.min(...amounts, avgAmount);
      let maxX = Math.max(...amounts, avgAmount);
      let minY = Math.min(...margins, avgMargin);
      let maxY = Math.max(...margins, avgMargin);

      // 若範圍太小，擴充一點避免線重疊點
      if (minX === maxX) { minX = minX - 1; maxX = maxX + 1; }
      if (minY === maxY) { minY = minY - 1; maxY = maxY + 1; }

      const padX = (maxX - minX) * 0.12;
      const padY = (maxY - minY) * 0.12;
      minX -= padX; maxX += padX;
      minY -= padY; maxY += padY;

      // dataset[0] = points
      chart.data.datasets[0].data = items.map(it => {
        return {
          x: it.amount,
          y: it.marginAfter,
          part: it.part,
          origin: it.origin,
          tariff: it.tariff,
          cost: it.cost,
          price: it.price,
          amount: it.amount,
          marginOriginal: it.marginOriginal,
          marginAfter: it.marginAfter,
          id: it.id
        };
      });
      // colors
      chart.data.datasets[0].backgroundColor = items.map(it => {
        // simple color hash by id
        const h = (it.id % 360);
        return `hsl(${h} 70% 45%)`;
      });

      // dataset[1] = 垂直平均銷售額線
      chart.data.datasets[1].data = [
        { x: avgAmount, y: minY, __line:true },
        { x: avgAmount, y: maxY, __line:true }
      ];

      // dataset[2] = 水平平均毛利線
      chart.data.datasets[2].data = [
        { x: minX, y: avgMargin, __line:true },
        { x: maxX, y: avgMargin, __line:true }
      ];

      // 更新坐標範圍
      chart.options.scales.x.min = minX;
      chart.options.scales.x.max = maxX;
      chart.options.scales.y.min = minY;
      chart.options.scales.y.max = maxY;

      chart.update();
    }

    // 頁面初始：若需要預載範例可放在此
    // updateAll();

    // 給使用者一個快速範例
    (function seedExample(){
      const example = [
        { part:'F056210', origin:'柬埔寨', cost:80, price:98, amount: 500 },
        { part:'F056211', origin:'泰國', cost:80, price:100, amount: 300 },
        { part:'F056212', origin:'臺灣', cost:86, price:100, amount: 150 },
        { part:'F016360', origin:'越南', cost:68, price:75, amount: 420 },
        { part:'F016361', origin:'中國', cost:68, price:75, amount: 210 }
      ];
      example.forEach(e => {
        const tariff = tariffRates[e.origin] ?? 0;
        const costWithTariff = e.cost * (1 + tariff / 100);
        const mOrig = ((e.price - e.cost) / e.price) * 100;
        const mAfter = ((e.price - costWithTariff) / e.price) * 100;
        items.push({
          id: Date.now() + Math.floor(Math.random()*1000),
          part: e.part, origin: e.origin, cost: e.cost, price: e.price, amount: e.amount,
          tariff, costWithTariff: Number(costWithTariff.toFixed(4)),
          marginOriginal: Number(mOrig.toFixed(2)),
          marginAfter: Number(mAfter.toFixed(2))
        });
      });
      updateAll();
    })();

    // 最後：提醒（當使用者新增新國家時，自動把關稅帶入）
    // originInput.onchange();

    // 等 DOMReady，並確保 Swiper 已被載入
    function initSwiper() {
      if (typeof Swiper === 'undefined') return;
      const swiper = new Swiper('#exmaple-swiper', {
        loop: false,
        navigation: {
          nextEl: '.swiper-button-next',
          prevEl: '.swiper-button-prev'
        },
        pagination: {
          el: '.swiper-pagination',
          clickable: true,
          renderBullet: function (index, className) {
            // 取對應 slide 的圖片
            const slides = document.querySelectorAll('#exmaple-swiper .swiper-slide');
            const img = slides[index]?.querySelector('img')?.getAttribute('src') || '';
            return `<span class="${className} swiper-pagination-thumb"><img src="${img}" alt="thumb${index+1}"></span>`;
          }
        }
      });
    }
    // 初始化Swiper
    if (window.Swiper) initSwiper();
    else window.addEventListener('load', initSwiper);

    // 切換 ai 與 report 顯示區塊
    const aiBtn = document.getElementById('ai-example-button');
    const rptBtn = document.getElementById('report-download-button');
    const aiSection = document.getElementById('ai-example');
    const rptSection = document.getElementById('report-download');
    // 初始狀態：顯示 ai，隱藏 report
    if (aiSection && rptSection) {
      aiSection.style.display = '';
      rptSection.style.display = 'none';
      aiBtn.setAttribute('aria-pressed', 'true');
      aiBtn.setAttribute('aria-controls', 'ai-example');
      aiBtn.setAttribute('aria-expanded', 'true');
      aiSection.setAttribute('aria-hidden', 'false');

      rptBtn.setAttribute('aria-pressed', 'false');
      rptBtn.setAttribute('aria-controls', 'report-download');
      rptBtn.setAttribute('aria-expanded', 'false');
      rptSection.setAttribute('aria-hidden', 'true');
    }

    aiBtn?.addEventListener('click', () => {
      if (!aiSection || !rptSection) return;
      aiSection.style.display = '';
      rptSection.style.display = 'none';
      aiBtn.setAttribute('aria-pressed', 'true');
      aiBtn.setAttribute('aria-expanded', 'true');
      aiSection.setAttribute('aria-hidden', 'false');

      rptBtn.setAttribute('aria-pressed', 'false');
      rptBtn.setAttribute('aria-expanded', 'false');
      rptSection.setAttribute('aria-hidden', 'true');
    });

    rptBtn?.addEventListener('click', () => {
      if (!aiSection || !rptSection) return;
      aiSection.style.display = 'none';
      rptSection.style.display = '';
      aiBtn.setAttribute('aria-pressed', 'false');
      aiBtn.setAttribute('aria-expanded', 'false');
      aiSection.setAttribute('aria-hidden', 'true');

      rptBtn.setAttribute('aria-pressed', 'true');
      rptBtn.setAttribute('aria-expanded', 'true');
      rptSection.setAttribute('aria-hidden', 'false');
    });