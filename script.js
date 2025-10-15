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
    const btnAddCountry = document.getElementById('btnAddCountry');

    // 將預設國家載入下拉與右側編輯區
    function renderCountryUI() {
      originInput.innerHTML = '';
      // countryEditor.innerHTML = '';

      // 先加入新增國家的選項
      const emptyOpt = document.createElement('option');
      emptyOpt.value = '';
      emptyOpt.textContent = '-- 新增國家 --';
      originInput.appendChild(emptyOpt);

      Object.keys(tariffRates).forEach((c) => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = `${c} — ${tariffRates[c]}%`;
        originInput.appendChild(opt);

        // 右側編輯列
        // const row = document.createElement('div');
        // row.style.display = 'flex';
        // row.style.gap = '8px';
        // row.style.alignItems = 'center';

        // const name = document.createElement('div');
        // name.style.flex = '1';
        // name.innerHTML = `<div style="font-weight:600">${c}</div><div class="meta">關稅 ${tariffRates[c]}%</div>`;

        // const btnDel = document.createElement('button');
        // btnDel.textContent = '刪除';
        // btnDel.onclick = () => {
        //   delete tariffRates[c];
        //   renderCountryUI();
        // };

        // row.appendChild(name);
        // row.appendChild(btnDel);
        // countryEditor.appendChild(row);
      });

      // 處理新增國家表單的顯示/隱藏
      originInput.onchange = () => {
        const showNewCountryForm = originInput.value === '';
        newCountryForm.style.display = showNewCountryForm ? 'block' : 'none';
        if (showNewCountryForm) {
          newCountryName.focus();
        }
      };

      // 預設帶入第一筆
      if (originInput.options.length > 1) { // 因為有空白選項，所以要 > 1
        originInput.selectedIndex = 1;
      }
    }

    // 新增國家UI
    // (function buildAddCountryControls() {
      // const wrapper = document.createElement('div');
      // wrapper.style.display = 'flex';
      // wrapper.style.gap = '8px';
      // wrapper.style.marginTop = '8px';

      // const name = document.createElement('input');
      // name.placeholder = '國家名稱';
      // name.style.flex = '1';

      // const rate = document.createElement('input');
      // rate.type = 'number';
      // rate.placeholder = '關稅%';
      // rate.style.width = '90px';

    //   const btn = document.createElement('button');
    //   btn.textContent = '+';
    //   btn.onclick = () => {
    //     const n = name.value.trim();
    //     const r = Number(rate.value) || 0;
    //     if (!n) return alert('請輸入國家名稱');
    //     tariffRates[n] = r;
    //     name.value = ''; rate.value = '';
    //     renderCountryUI();
    //   };

    //   wrapper.appendChild(name);
    //   wrapper.appendChild(rate);
    //   wrapper.appendChild(btn);
    //   countryEditor.appendChild(wrapper);
    // })();

    renderCountryUI();

    // ----------------------------------------------------
    // 主要資料
    // ----------------------------------------------------
    let items = []; // 每筆: { id, part, origin, cost, price, amount, tariff, costWithTariff, marginOriginal, marginAfter }

    // Chart.js 初始
    const ctx = document.getElementById('chartCanvas').getContext('2d');
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
        responsive: false,
        interaction: { mode: 'nearest', intersect: true },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              // 自訂 tooltip 內容，顯示完整資訊
              label: (ctx) => {
                const d = ctx.raw;
                // 如果是線，直接顯示空字串
                if (!d || d.__line) return '';
                return `${d.part} | 產地:${d.origin} | 關稅:${d.tariff}% | 成本:${d.cost} | 售價:${d.price} | 銷售額:${d.amount} | 原毛利:${d.marginOriginal}% | 關稅後:${d.marginAfter}%`;
              }
            }
          }
        },
        scales: {
          x: { title: { display: true, text: '銷售金額' }, beginAtZero: false },
          y: { title: { display: true, text: '關稅後毛利率 (%)' } }
        }
      }
    });

    // 新增一筆資料（按鈕）
    btnAdd.onclick = () => {
      const part = partInput.value.trim();
      let origin = originInput.value;
      const cost = Number(costInput.value);
      const price = Number(priceInput.value);
      const amount = Number(amountInput.value);
      
      // 如果選擇新增國家，先處理新國家的新增
      if (origin === '') {
        const newName = newCountryName.value.trim();
        const newTariff = parseFloat(newCountryTariff.value);

        if (!newName) {
          alert('請輸入國家名稱');
          return;
        }
        if (isNaN(newTariff)) {
          alert('請輸入有效的關稅率');
          return;
        }
        if (tariffRates[newName] !== undefined) {
          alert('此國家已存在');
          return;
        }

        // 新增國家到 tariffRates
        tariffRates[newName] = newTariff;
        saveTariffRates();
        renderCountryUI();
        
        // 設定為目前選擇的國家
        origin = newName;
        originInput.value = newName;
        
        // 重置新增國家表單
        newCountryName.value = '';
        newCountryTariff.value = '';
        newCountryForm.style.display = 'none';
      }
      
      const tariff = tariffRates[origin] ?? 0;

      if (!part) return alert('請輸入料件編號');
      if (!origin) return alert('請選擇產地');
      if (!cost || !price || !amount) return alert('成本/售價/銷售金額都要填寫且大於 0');

      // 計算邏輯（與你 Python 的邏輯一致）
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
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div>
              <div style="font-weight:600">${it.part} <span class="meta">(${it.origin})</span></div>
              <div class="meta">成本:${it.cost}，售價:${it.price}，銷售額:${it.amount}</div>
              <div class="meta">關稅:${it.tariff}% → 到岸成本:${it.costWithTariff}，原毛利:${it.marginOriginal}%，關稅後:${it.marginAfter}%</div>
            </div>
            <div style="display:flex;flex-direction:column;gap:6px">
              <button data-id="${it.id}" class="btnDel">刪除</button>
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

    // 給使用者一個快速範例（你可以移除）
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
    originInput.onchange();