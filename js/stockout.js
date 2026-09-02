// ============================================================
// ✅ 紧急占位：提前暴露函数（防止 HTML 按钮报错）
// ============================================================
(function() {
    console.log('🚀 stockout.js 开始加载...');
    
    // 先占位
    if (typeof window.openStockOutForm === 'undefined') {
        window.openStockOutForm = function() {
            console.warn('⚠️ openStockOutForm 占位函数被调用');
            alert('出库功能正在加载，请刷新页面后重试');
        };
        console.log('✅ 占位函数已设置');
    }
})();
// ===================== 出库模块 - 纯业务函数 =====================
let outCurrSupplierList = [];
let outCurrGoodsList = [];
let outCurrSpecOptions = [];
let outSelectedSpecData = null;

// ========== 出库筛选数据 ==========
let outFilterData = {
    supplier: [],
    goodsName: [],
    settleType: ['线上', '线下']
};


// ========== 刷新出库列表 ==========
function refreshStockOut() {
    loadStockOut();
}

// ========== 加载商品规格绑定数据 ==========
async function loadGoodsUnitBind() {
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/goods_unit_bind?select=*`, {
            headers: {
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${SUPABASE_KEY}`
            }
        });
        if (!response.ok) throw new Error('加载商品规格绑定失败');
        const data = await response.json();
        window.allGoodsUnitBind = data;
        console.log('商品规格绑定加载完成:', data.length);
        return data;
    } catch (e) {
        console.error('加载商品规格绑定失败：', e);
        window.allGoodsUnitBind = [];
        return [];
    }
}

// ========== 加载规格单位数据 ==========
async function loadUnitSpecs() {
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/unit_spec?select=*`, {
            headers: {
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${SUPABASE_KEY}`
            }
        });
        if (!response.ok) throw new Error('加载规格单位失败');
        const data = await response.json();
        window.allUnitSpecs = data;
        console.log('规格单位加载完成:', data.length);
        return data;
    } catch (e) {
        console.error('加载规格单位失败：', e);
        window.allUnitSpecs = [];
        return [];
    }
}

// ========== 加载基础单位数据 ==========
async function loadAllBaseUnits() {
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/base_unit?select=*`, {
            headers: {
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${SUPABASE_KEY}`
            }
        });
        if (!response.ok) throw new Error('加载基础单位失败');
        const data = await response.json();
        window.allBaseUnits = data;
        console.log('基础单位加载完成:', data.length);
        return data;
    } catch (e) {
        console.error('加载基础单位失败：', e);
        window.allBaseUnits = [];
        return [];
    }
}

// ========== 出库筛选下拉 ==========
function initOutFilterData() {
    if (!allStockOut || allStockOut.length === 0) return;
    outFilterData.supplier = [...new Set(allStockOut.map(item => item.supplier).filter(s => s))].sort();
    outFilterData.goodsName = [...new Set(allStockOut.map(item => item.goodsName).filter(n => n))].sort();
}

function showOutFilterList(type) {
    const listId = `outFilter${capitalize(type)}List`;
    const box = document.getElementById(listId);
    if (!box) return;
    const inputId = `outFilter${capitalize(type)}Input`;
    const input = document.getElementById(inputId);
    const kw = input ? input.value.toLowerCase().trim() : '';
    renderOutFilterList(type, kw);
    box.style.display = 'block';
}

function filterOutFilterList(type) {
    const inputId = `outFilter${capitalize(type)}Input`;
    const input = document.getElementById(inputId);
    const kw = input.value.toLowerCase().trim();
    renderOutFilterList(type, kw);
    const listId = `outFilter${capitalize(type)}List`;
    const box = document.getElementById(listId);
    if (box) box.style.display = 'block';
}

function renderOutFilterList(type, keyword = '') {
    const listId = `outFilter${capitalize(type)}List`;
    const box = document.getElementById(listId);
    if (!box) return;
    let data = outFilterData[type] || [];
    if (keyword) {
        data = data.filter(item => item.toLowerCase().includes(keyword));
    }
    box.innerHTML = '';
    if (data.length === 0) {
        box.innerHTML = '<div style="padding:6px 10px;color:#999;">无匹配</div>';
        return;
    }
    data.forEach(opt => {
        const div = document.createElement('div');
        div.style.padding = '4px 10px';
        div.style.cursor = 'pointer';
        div.style.borderBottom = '1px solid #eee';
        div.textContent = opt;
        div.onclick = function() {
            const inputId = `outFilter${capitalize(type)}Input`;
            document.getElementById(inputId).value = opt;
            box.style.display = 'none';
            filterStockOut();
        };
        box.appendChild(div);
    });
}

function resetOutSearch() {
    document.getElementById('outFilterSupplierInput').value = '';
    document.getElementById('outFilterGoodsNameInput').value = '';
    document.getElementById('outFilterSettleTypeInput').value = '';
    document.querySelectorAll('[id^="outFilter"][id$="List"]').forEach(el => el.style.display = 'none');
    filterStockOut();
}

// ========== 出库实时搜索（输入即搜索） ==========
function onOutFilterInput() {
    filterStockOut();
    const supplierInput = document.getElementById('outFilterSupplierInput');
    const goodsInput = document.getElementById('outFilterGoodsNameInput');
    const settleInput = document.getElementById('outFilterSettleTypeInput');
    
    if (document.activeElement === supplierInput) {
        renderOutFilterList('supplier', supplierInput.value.trim());
        const list = document.getElementById('outFilterSupplierList');
        if (list) list.style.display = 'block';
    } else if (document.activeElement === goodsInput) {
        renderOutFilterList('goodsName', goodsInput.value.trim());
        const list = document.getElementById('outFilterGoodsNameList');
        if (list) list.style.display = 'block';
    } else if (document.activeElement === settleInput) {
        renderOutFilterList('settleType', settleInput.value.trim());
        const list = document.getElementById('outFilterSettleTypeList');
        if (list) list.style.display = 'block';
    }
}

// ========== 供应商下拉 ==========
async function showOutSupList() {
    if (!allStockIn || allStockIn.length === 0) {
        await loadStockIn();
    }
    outCurrSupplierList = [...new Set(allStockIn.map(item => item.supplier).filter(s => s))];
    renderOutSupList(outCurrSupplierList);
    document.getElementById('outSupListBox').style.display = 'block';
}

function filterOutSupList() {
    let kw = document.getElementById('outSupSearchInput').value.toLowerCase();
    let res = outCurrSupplierList.filter(s => s.toLowerCase().includes(kw));
    renderOutSupList(res);
    document.getElementById('outSupListBox').style.display = 'block';
}

function renderOutSupList(list) {
    let box = document.getElementById('outSupListBox');
    box.innerHTML = '';
    if (list.length === 0) {
        box.innerHTML = '<div>无匹配数据</div>';
        return;
    }
    list.forEach(sup => {
        let div = document.createElement('div');
        div.innerText = sup;
        div.onclick = function() {
            document.getElementById('outSupSearchInput').value = sup;
            document.getElementById('outSupListBox').style.display = 'none';
            loadOutGoodsBySupplier(sup);
        };
        box.appendChild(div);
    });
}

// ========== 根据供应商加载对应商品 ==========
function loadOutGoodsBySupplier(supplier) {
    const uniqueMap = new Map();
    allStockIn
        .filter(item => item.supplier === supplier)
        .forEach(item => {
            const key = `${item.goodsName}||${item.spec || ''}`;
            if (!uniqueMap.has(key)) {
                uniqueMap.set(key, {
                    name: item.goodsName,
                    spec: item.spec,
                    settleType: item.settleType,
                    salePrice: item.sale_price
                });
            }
        });
    let goodsArr = Array.from(uniqueMap.values());
    outCurrGoodsList = goodsArr;
    document.getElementById('outGoodsSearchInput').value = '';
    document.getElementById('outCurGoodsId').value = '';
    document.getElementById('outSpec').value = '';
    document.getElementById('outSettleType').value = '';
    document.getElementById('outSalePrice').value = '';
    document.getElementById('totalStockNum').value = '0';
    document.getElementById('outNum').value = '';
}

// ========== 商品下拉 ==========
function showOutGoodsList() {
    renderOutGoodsList(outCurrGoodsList);
    document.getElementById('outGoodsListBox').style.display = 'block';
}

function filterOutGoodsList() {
    let kw = document.getElementById('outGoodsSearchInput').value.toLowerCase();
    let res = outCurrGoodsList.filter(g => g.name.toLowerCase().includes(kw));
    renderOutGoodsList(res);
    document.getElementById('outGoodsListBox').style.display = 'block';
}

function renderOutGoodsList(list) {
    let box = document.getElementById('outGoodsListBox');
    box.innerHTML = '';
    if (list.length === 0) {
        box.innerHTML = '<div>无匹配数据</div>';
        return;
    }
    list.forEach(goods => {
        let div = document.createElement('div');
        div.innerText = goods.name;
        div.onclick = function() {
            selectOutGoods(goods);
            document.getElementById('outGoodsListBox').style.display = 'none';
        };
        box.appendChild(div);
    });
}

// ========== 选择商品，自动带出字段 + 加载总库存 ==========
async function selectOutGoods(goods) {
    let sup = document.getElementById('outSupSearchInput').value;
    document.getElementById('outGoodsSearchInput').value = goods.name;
    document.getElementById('outSpec').value = goods.spec || '';
    document.getElementById('outSettleType').value = goods.settleType || '';

    const specSelect = document.getElementById('outSpecSelect');
    specSelect.innerHTML = '<option value="">请选择换算规格</option>';
    outCurrSpecOptions = [];
    outSelectedSpecData = null;
    
    const goodsItem = allGoods.find(g => g.supplier === sup && g.name === goods.name);
    if (goodsItem) {
        try {
            if (!window.allGoodsUnitBind || window.allGoodsUnitBind.length === 0) {
                await loadGoodsUnitBind();
            }
            if (!window.allUnitSpecs || window.allUnitSpecs.length === 0) {
                await loadUnitSpecs();
            }
            if (!window.allBaseUnits || window.allBaseUnits.length === 0) {
                await loadAllBaseUnits();
            }
            
            const bindSpecs = window.allGoodsUnitBind.filter(bind => bind.goods_id === goodsItem.id);
            console.log('商品规格绑定:', bindSpecs);
            
            bindSpecs.forEach((bind, index) => {
                const specItem = window.allUnitSpecs?.find(s => s.id === bind.spec_id);
                const specName = specItem?.show_name || `规格${index + 1}`;
                let baseUnitName = '个';
                if (specItem && specItem.base_unit_id) {
                    const baseItem = window.allBaseUnits?.find(b => b.id === specItem.base_unit_id);
                    if (baseItem && baseItem.unit_name) {
                        baseUnitName = baseItem.unit_name;
                    }
                }
                if (baseUnitName === '个' && goodsItem.base_unit) {
                    baseUnitName = goodsItem.base_unit;
                }
                const conversionRate = specItem?.convert_rate || 1;
                
                const option = document.createElement('option');
                option.value = bind.spec_id;
                option.textContent = `${specName}（${conversionRate}${baseUnitName}）`;
                option.dataset.specId = bind.spec_id;
                option.dataset.conversionRate = conversionRate;
                option.dataset.baseUnit = baseUnitName;
                option.dataset.specName = specName;
                specSelect.appendChild(option);
                
                outCurrSpecOptions.push({
                    specId: bind.spec_id,
                    display: specName,
                    originalSpec: goods.spec || '',
                    unit: specName,
                    baseUnit: baseUnitName,
                    conversion_rate: conversionRate,
                    specName: specName,
                    goodsId: goodsItem.id,
                    bindId: bind.id,
                    baseUnitId: specItem?.base_unit_id || null
                });
            });
            
            if (bindSpecs.length === 0) {
                const defaultSpec = {
                    specId: 0,
                    display: goods.spec || '默认规格',
                    originalSpec: goods.spec || '',
                    unit: goodsItem.base_unit || '个',
                    baseUnit: goodsItem.base_unit || '个',
                    conversion_rate: 1,
                    specName: '默认',
                    goodsId: goodsItem.id,
                    bindId: 0
                };
                outCurrSpecOptions.push(defaultSpec);
                const option = document.createElement('option');
                option.value = '0';
                option.textContent = defaultSpec.display;
                specSelect.appendChild(option);
            }
        } catch (e) {
            console.error('加载换算规格失败：', e);
            const defaultSpec = {
                specId: 0,
                display: goods.spec || '默认规格',
                originalSpec: goods.spec || '',
                unit: goodsItem?.base_unit || '个',
                baseUnit: goodsItem?.base_unit || '个',
                conversion_rate: 1,
                specName: '默认',
                goodsId: goodsItem?.id || 0,
                bindId: 0
            };
            outCurrSpecOptions.push(defaultSpec);
            const option = document.createElement('option');
            option.value = '0';
            option.textContent = defaultSpec.display;
            specSelect.appendChild(option);
        }
    } else {
        const defaultSpec = {
            specId: 0,
            display: goods.spec || '默认规格',
            originalSpec: goods.spec || '',
            unit: '个',
            baseUnit: '个',
            conversion_rate: 1,
            specName: '默认',
            goodsId: 0,
            bindId: 0
        };
        outCurrSpecOptions.push(defaultSpec);
        const option = document.createElement('option');
        option.value = '0';
        option.textContent = defaultSpec.display;
        specSelect.appendChild(option);
    }
    
    if (outCurrSpecOptions.length > 0) {
        specSelect.value = outCurrSpecOptions[0].specId;
        outSelectedSpecData = outCurrSpecOptions[0];
        document.getElementById('outSpec').value = outCurrSpecOptions[0].originalSpec || '';
        
        if (!allStockIn || allStockIn.length === 0) {
            await loadStockIn();
        }
        if (!allStockOut || allStockOut.length === 0) {
            await loadStockOut();
        }
        if (typeof refreshAllStockCache === 'function') {
            refreshAllStockCache(allStockIn, allStockOut);
        }
        
        updateTotalStockDisplay();
        updateSalePrice();
    }
}

// ========== 换算规格变更处理 ==========
function onOutSpecChange() {
    const select = document.getElementById('outSpecSelect');
    const selectedValue = parseInt(select.value);
    
    console.log('规格变更:', { selectedValue, options: outCurrSpecOptions });
    
    if (!selectedValue && selectedValue !== 0) {
        document.getElementById('outSpec').value = '';
        document.getElementById('outSalePrice').value = '';
        document.getElementById('outSalePrice').placeholder = '请选择换算规格';
        document.getElementById('totalStockNum').value = '0';
        outSelectedSpecData = null;
        return;
    }
    
    const specData = outCurrSpecOptions.find(item => item.specId === selectedValue);
    if (specData) {
        outSelectedSpecData = specData;
        document.getElementById('outSpec').value = specData.originalSpec || '';
        console.log('选中规格数据:', specData);
        updateTotalStockDisplay();
        updateSalePrice();
    }
}

// ========== 本地计算总库存（降级方案） ==========
function calculateTotalStockLocally(supplier, goodsName) {
    let total = 0;
    if (!allStockIn || allStockIn.length === 0) return 0;
    const inRecords = allStockIn.filter(item => 
        item.supplier === supplier && item.goodsName === goodsName
    );
    for (const record of inRecords) {
        let stock = record.base_num || record.in_num || 0;
        if (allStockOut && allStockOut.length > 0) {
            const outRecords = allStockOut.filter(out => 
                out.inRecordId === record.id && out.goodsName === goodsName && out.supplier === supplier
            );
            const totalOut = outRecords.reduce((sum, out) => sum + (out.outNum || 0), 0);
            stock = stock - totalOut;
        }
        if (window.allReturnGoods && window.allReturnGoods.length > 0) {
            const returnRecords = window.allReturnGoods.filter(ret => ret.in_record_id === record.id);
            const totalReturn = returnRecords.reduce((sum, ret) => sum + (ret.return_num || 0), 0);
            stock = stock - totalReturn;
        }
        if (stock > 0) total += stock;
    }
    return total;
}

// ========== 更新总库存显示（按换算规格） ==========
async function updateTotalStockDisplay() {
    const supplier = document.getElementById('outSupSearchInput').value.trim();
    const goodsName = document.getElementById('outGoodsSearchInput').value.trim();
    const specData = outSelectedSpecData;
    
    if (!supplier || !goodsName || !specData) {
        document.getElementById('totalStockNum').value = '0';
        window._outConvertedStockQty = 0;
        window._outBaseUnitStockQty = 0;
        window._outConversionRate = 1;
        return;
    }
    
    const goodsItem = allGoods.find(g => g.supplier === supplier && g.name === goodsName);
    if (!goodsItem) {
        document.getElementById('totalStockNum').value = '0';
        return;
    }
    
    // ✅ 直接从 getStockBatchList 计算总库存
    const batchList = getStockBatchList(supplier, goodsName);
    let totalBaseUnit = 0;
    for (const batch of batchList) {
        totalBaseUnit += batch.batchRemain;
    }
    
    console.log('📊 批次列表:', batchList);
    console.log('📊 总库存（最小计量单位）:', totalBaseUnit);
    
    if (totalBaseUnit === 0) {
        document.getElementById('totalStockNum').value = '0';
        window._outConvertedStockQty = 0;
        window._outBaseUnitStockQty = 0;
        window._outConversionRate = 1;
        return;
    }
    
    const baseUnit = specData.baseUnit || goodsItem.base_unit || '个';
    const specUnit = specData.specName || specData.unit || '个';
    const conversionRate = specData.conversion_rate || 1;
    
    const convertedQty = Math.floor(totalBaseUnit / conversionRate);
    const remainder = totalBaseUnit % conversionRate;
    
    let displayText = '';
    if (convertedQty > 0 && remainder > 0) {
        displayText = `${convertedQty}${specUnit} + ${remainder}${baseUnit}`;
    } else if (convertedQty > 0) {
        displayText = `${convertedQty}${specUnit}`;
    } else if (remainder > 0) {
        displayText = `${remainder}${baseUnit}`;
    } else {
        displayText = '0';
    }
    
    document.getElementById('totalStockNum').value = displayText;
    
    window._outConvertedStockQty = convertedQty;
    window._outBaseUnitStockQty = totalBaseUnit;
    window._outConversionRate = conversionRate;
    
    console.log('总库存换算显示:', {
        totalBaseUnit,
        conversionRate,
        convertedQty,
        remainder,
        displayText
    });
}
// ========== 根据规格获取价格 ==========
async function getSalePriceByBzStatusAndSpec(goodsId, specId, bzStatus) {
    try {
        let query = `${SUPABASE_URL}/rest/v1/price_temp_state?goods_id=eq.${goodsId}&spec_id=eq.${specId}&select=*`;
        console.log('🔍 查询价格:', query);
        const response = await fetch(query, {
            headers: {
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${SUPABASE_KEY}`
            }
        });
        
        if (!response.ok) {
            console.warn('价格表查询失败:', response.status);
            return null;
        }
        
        const data = await response.json();
        console.log('📊 价格数据:', data);
        
        if (!data || data.length === 0) {
            if (specId > 0) {
                const fallbackQuery = `${SUPABASE_URL}/rest/v1/price_temp_state?goods_id=eq.${goodsId}&spec_id=eq.0&select=*`;
                console.log('🔍 降级查询默认价格:', fallbackQuery);
                const fallbackResponse = await fetch(fallbackQuery, {
                    headers: {
                        apikey: SUPABASE_KEY,
                        Authorization: `Bearer ${SUPABASE_KEY}`
                    }
                });
                if (fallbackResponse.ok) {
                    const fallbackData = await fallbackResponse.json();
                    if (fallbackData && fallbackData.length > 0) {
                        return getPriceFromRecord(fallbackData[0], bzStatus);
                    }
                }
            }
            return null;
        }
        
        const priceRecord = data[0];
        return getPriceFromRecord(priceRecord, bzStatus);
    } catch (e) {
        console.error('获取价格异常：', e);
        return null;
    }
}

// ========== 辅助：从价格记录中提取价格 ==========
function getPriceFromRecord(priceRecord, bzStatus) {
    console.log('📋 提取价格, 状态:', bzStatus, '记录:', priceRecord);
    
    if (bzStatus === '正常') {
        return priceRecord.sale_price !== undefined && priceRecord.sale_price !== null ? Number(priceRecord.sale_price) : null;
    } else if (bzStatus === '过期') {
        return priceRecord.expire_price !== undefined && priceRecord.expire_price !== null ? Number(priceRecord.expire_price) : null;
    } else if (bzStatus.startsWith('discount_')) {
        const match = bzStatus.match(/discount_(\d+)/);
        if (match) {
            const idx = parseInt(match[1]);
            const fieldMap = {
                1: 'discount_1_price',
                2: 'discount_2_price',
                3: 'discount_3_price',
                4: 'discount_4_price'
            };
            const field = fieldMap[idx];
            if (field && priceRecord[field] !== undefined && priceRecord[field] !== null) {
                return Number(priceRecord[field]);
            }
        }
        return null;
    }
    return priceRecord.sale_price !== undefined && priceRecord.sale_price !== null ? Number(priceRecord.sale_price) : null;
}

// ========== 更新销售价格 ==========
async function updateSalePrice() {
    const supplier = document.getElementById('outSupSearchInput').value.trim();
    const goodsName = document.getElementById('outGoodsSearchInput').value.trim();
    const specData = outSelectedSpecData;
    
    const priceInput = document.getElementById('outSalePrice');
    
    if (!supplier || !goodsName || !specData) {
        priceInput.value = '';
        priceInput.placeholder = '请先选择商品和换算规格';
        priceInput.style.color = '';
        window._outSelectedSalePrice = null;
        return;
    }
    
    const goodsItem = allGoods.find(g => g.supplier === supplier && g.name === goodsName);
    if (!goodsItem) {
        priceInput.value = '';
        priceInput.placeholder = '商品信息不存在';
        priceInput.style.color = '#ff6b6b';
        window._outSelectedSalePrice = null;
        return;
    }
    
    const validBatchList = getStockBatchList(supplier, goodsName);
    if (validBatchList.length === 0) {
        priceInput.value = '';
        priceInput.placeholder = '无库存批次';
        priceInput.style.color = '#ff6b6b';
        window._outSelectedSalePrice = null;
        return;
    }
    
    const firstValidBatch = validBatchList[0];
    const earliest = firstValidBatch.inRecords[0];
    
    const expireResult = calculateExpireDays(goodsItem.shelf_life_num, goodsItem.shelf_life_unit);
    let warnDay = 0;
    if (typeof expireResult === 'string' && expireResult.includes('天')) {
        warnDay = parseInt(expireResult) || 0;
    } else if (typeof expireResult === 'number') {
        warnDay = expireResult;
    } else {
        warnDay = Number(expireResult) || 0;
    }
    
    let unitCode = "day";
    if (goodsItem.shelf_life_unit === "年") unitCode = "year";
    if (goodsItem.shelf_life_unit === "个月") unitCode = "month";
    
    const bzResult = calcBzStatus(
        earliest.produce_date || '',
        earliest.expire_date || '',
        goodsItem.shelf_life_num || 0,
        unitCode,
        warnDay
    );
    const bzStatus = bzResult.statusText || '正常';
    window._outSelectedBzStatus = bzStatus;
    
    try {
        const specId = specData.specId || 0;
        console.log('获取价格参数:', { goodsId: goodsItem.id, specId, bzStatus });
        let price = await getSalePriceByBzStatusAndSpec(goodsItem.id, specId, bzStatus);
        console.log('获取到的价格:', price);
        
        if (price === null || price === undefined || price === 0) {
            priceInput.value = '';
            window._outSelectedSalePrice = null;
            priceInput.placeholder = '价格未录入，请提醒商品部录入';
            priceInput.style.color = '#ff6b6b';
        } else {
            priceInput.value = formatMoney(price);
            window._outSelectedSalePrice = price;
            priceInput.placeholder = '';
            priceInput.style.color = '';
        }
    } catch (e) {
        console.error('获取价格失败：', e);
        priceInput.value = '';
        priceInput.placeholder = '价格获取失败';
        priceInput.style.color = '#ff6b6b';
        window._outSelectedSalePrice = null;
    }
}

// ========== 出库数量实时库存校验 ==========
function checkStockNum() {
    let outNum = Number(document.getElementById('outNum').value) || 0;
    const selectedSpec = outSelectedSpecData;
    
    if (!selectedSpec) {
        return;
    }
    
    const convertedQty = window._outConvertedStockQty || 0;
    const totalDisplay = document.getElementById('totalStockNum').value;
    
    if (convertedQty === 0) {
        alert('当前商品无可用库存！');
        document.getElementById('outNum').value = '';
        return;
    }
    
    if (outNum > convertedQty && convertedQty > 0) {
        alert(`库存不足！当前可用库存：${totalDisplay}`);
        document.getElementById('outNum').value = convertedQty;
    }
}

// ========== 打开新增出库弹窗 ==========
async function openStockOutForm() {
    if (!allStockIn || allStockIn.length === 0) {
        await loadStockIn();
    }
    if (!allStockOut || allStockOut.length === 0) {
        await loadStockOut();
    }
    if (!window.allGoodsUnitBind || window.allGoodsUnitBind.length === 0) {
        await loadGoodsUnitBind();
    }
    if (!window.allUnitSpecs || window.allUnitSpecs.length === 0) {
        await loadUnitSpecs();
    }
    if (!window.allBaseUnits || window.allBaseUnits.length === 0) {
        await loadAllBaseUnits();
    }
    
    document.getElementById('outEditId').value = '';
    document.getElementById('stockOutFormTitle').innerText = '添加出库单据';
    
    document.getElementById('outType').value = '';
    document.getElementById('outSupSearchInput').value = '';
    document.getElementById('outGoodsSearchInput').value = '';
    document.getElementById('outCurGoodsId').value = '';
    document.getElementById('outSpec').value = '';
    document.getElementById('outSpecSelect').innerHTML = '<option value="">请先选择商品</option>';
    document.getElementById('outSettleType').value = '';
    document.getElementById('outSalePrice').value = '';
    document.getElementById('outSalePrice').placeholder = '请先选择商品和换算规格';
    document.getElementById('totalStockNum').value = '0';
    document.getElementById('outNum').value = '';
    document.getElementById('outRecordDate').value = new Date().toISOString().split('T')[0];
    
    outCurrSpecOptions = [];
    outSelectedSpecData = null;
    window._outConvertedStockQty = 0;
    window._outBaseUnitStockQty = 0;
    window._outConversionRate = 1;
    
    const priceInput = document.getElementById('outSalePrice');
    priceInput.style.color = '';
    
    window._outSelectedSalePrice = null;
    window._outSelectedBzStatus = '';
    
    const supBox = document.getElementById('outSupListBox');
    if (supBox) supBox.style.display = 'none';
    const goodsBox = document.getElementById('outGoodsListBox');
    if (goodsBox) goodsBox.style.display = 'none';
    
    outCurrGoodsList = [];
    
    document.getElementById('stockOutModal').style.display = 'block';
}

// ========== 关闭出库弹窗 ==========
function closeStockOutForm() {
    const msgModal = document.getElementById('msgModal');
    if (msgModal) {
        msgModal.style.display = 'none';
    }
    const supBox = document.getElementById('outSupListBox');
    if (supBox) supBox.style.display = 'none';
    const goodsBox = document.getElementById('outGoodsListBox');
    if (goodsBox) goodsBox.style.display = 'none';
    document.getElementById('stockOutModal').style.display = 'none';
}

// ========== 出库后更新库存字段 ==========
async function updateStockFieldsAfterOut(supplier, goodsName) {
    try {
        console.log('🔄 开始更新出库后库存字段:', supplier, goodsName);
        
        const encodedSupplier = encodeURIComponent(supplier);
        const encodedGoodsName = encodeURIComponent(goodsName);
        
        const inRes = await fetch(`${SUPABASE_URL}/rest/v1/stock_in?supplier=eq.${encodedSupplier}&goodsName=eq.${encodedGoodsName}`, {
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
        });
        const allInRecords = await inRes.json();
        
        if (!allInRecords || allInRecords.length === 0) {
            console.log('没有找到入库记录');
            return;
        }
        
        const outRes = await fetch(`${SUPABASE_URL}/rest/v1/stock_out?supplier=eq.${encodedSupplier}&goodsName=eq.${encodedGoodsName}`, {
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
        });
        const allOutRecords = await outRes.json() || [];
        
        const returnRes = await fetch(`${SUPABASE_URL}/rest/v1/return_goods?supplier=eq.${encodedSupplier}&goodsName=eq.${encodedGoodsName}`, {
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
        });
        const allReturnRecords = await returnRes.json() || [];
        
        let totalStockSum = 0;
        
        for (const record of allInRecords) {
            const outTotal = allOutRecords
                .filter(out => out.inRecordId === record.id)
                .reduce((sum, out) => sum + (out.outNum || 0), 0);
            
            const returnTotal = allReturnRecords
                .filter(ret => ret.in_record_id === record.id)
                .reduce((sum, ret) => sum + (ret.return_num || 0), 0);
            
            const baseNum = record.base_num || record.in_num || 0;
            const batchRemain = Math.max(0, baseNum - outTotal - returnTotal);
            
            await fetch(`${SUPABASE_URL}/rest/v1/stock_in?id=eq.${record.id}`, {
                method: 'PATCH',
                headers: {
                    apikey: SUPABASE_KEY,
                    Authorization: `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ batch_stock: batchRemain })
            });
            
            totalStockSum += batchRemain;
        }
        
        for (const record of allInRecords) {
            await fetch(`${SUPABASE_URL}/rest/v1/stock_in?id=eq.${record.id}`, {
                method: 'PATCH',
                headers: {
                    apikey: SUPABASE_KEY,
                    Authorization: `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ total_stock: totalStockSum })
            });
        }
        
        console.log(`✅ 出库后库存字段更新完成: 总库存=${totalStockSum}`);
    } catch (e) {
        console.error('出库后更新库存字段失败:', e);
    }
}

// ========== 提交出库（修正版：支持平台销售/报损/赠送） ==========
async function submitStockOut() {
    let supplier = document.getElementById('outSupSearchInput').value.trim();
    let goodsName = document.getElementById('outGoodsSearchInput').value.trim();
    let spec = document.getElementById('outSpec').value || ''; 
    let settleType = document.getElementById('outSettleType').value || '';
    let outType = document.getElementById('outType').value || ''; // 出库类型
    let salePriceText = document.getElementById('outSalePrice').value;
    let salePrice = parseFloat(salePriceText.replace(/[￥,¥]/g, '')) || 0;
    let outNum = Number(document.getElementById('outNum').value) || 0; 
    let recordDate = document.getElementById('outRecordDate').value;
    
    // 基础校验
    if (!outType) return alert('请选择出库类型');
    if (!supplier) return alert('请选择供应商');
    if (!goodsName) return alert('请选择商品');
    if (!document.getElementById('outSpecSelect').value) return alert('请选择换算规格');
    if (outNum < 1) return alert('出库数量必须大于0');
    if (!recordDate) return alert('请选择录入日期');

    // 库存逻辑校验（报损/赠送也需要消耗库存）
    const bzStatus = window._outSelectedBzStatus || '';
    if (bzStatus === '过期') return alert('⚠️ 当前商品已过期，请做退货处理！');
    
    const convertedQty = window._outConvertedStockQty || 0;
    const baseQty = window._outBaseUnitStockQty || 0;
    const conversionRate = window._outConversionRate || 1;
    
    if (outNum > convertedQty) return alert(`库存不足！当前可用库存：${document.getElementById('totalStockNum').value}`);
    const actualOutBaseQty = outNum * conversionRate; 
    if (actualOutBaseQty > baseQty) return alert(`库存不足！当前可用库存（最小计量单位）：${baseQty}`);
    
    // 严格按 FIFO 扣减
    const outDetail = calcFIFOOut(supplier, goodsName, actualOutBaseQty);
    if (outDetail.length === 0) return alert('无可用库存批次');
    let detailStr = JSON.stringify(outDetail);
    
    // 计算总出库成本（无论何种类型，成本必须产生）
    let totalOutAmount = 0;
    let goodsItem = allGoods.find(g => g.name === goodsName && g.supplier === supplier);
    if (settleType === '线上') {
        let onlineCost = goodsItem ? Number(goodsItem.online_cost) : 0;
        totalOutAmount = Number((onlineCost * actualOutBaseQty).toFixed(2));
    } else {
        let totalInPriceSum = 0;
        outDetail.forEach(detail => {
            let inRec = allStockIn.find(inRec => String(inRec.id) === String(detail.inRecordId));
            if (inRec) totalInPriceSum += Number(inRec.in_price || 0) * detail.useNum;
        });
        totalOutAmount = Number(totalInPriceSum.toFixed(2));
    }

    // ====== 核心修改：根据出库类型判定销售金额 ======
    let finalSalePrice = salePrice;
    let saleAmount = 0;
    
    if (outType === '平台销售') {
        // 平台销售：必须校验价格并计算销售金额
        const priceValue = document.getElementById('outSalePrice').value || '';
        const isPriceEmpty = !priceValue || priceValue === '' || priceValue === '￥0.00' || priceValue === '￥' || priceValue === '￥0' || priceValue.trim() === '' || priceValue === '价格未录入' || priceValue.includes('请选择') || priceValue.includes('未录入');
        const tempSelectedPrice = window._outSelectedSalePrice !== null && window._outSelectedSalePrice !== undefined ? window._outSelectedSalePrice : salePrice;
        
        if (isPriceEmpty || tempSelectedPrice === null || tempSelectedPrice === 0 || tempSelectedPrice === undefined) return alert('请提醒商品部人员录入价格！');
        
        finalSalePrice = tempSelectedPrice;
        saleAmount = Number((finalSalePrice * outNum).toFixed(2));
        
    } else if (outType === '报损' || outType === '赠送') {
        // 报损/赠送：不产生销售收入
        finalSalePrice = 0;
        saleAmount = 0;
    }
    
    // ✅ 严格只发送 stock_out 表真实存在的字段
    let postData = {
        supplier: supplier,
        goodsName: goodsName,
        spec: outSelectedSpecData?.specName || spec,
        settleType: settleType,
        outType: outType, // 新增：存储出库类型
        outPrice: totalOutAmount > 0 ? Number((totalOutAmount / actualOutBaseQty).toFixed(2)) : 0,
        salePrice: finalSalePrice, // 报损/赠送时为 0
        outNum: actualOutBaseQty,
        outAmount: totalOutAmount,
        saleAmount: saleAmount,    // 报损/赠送时为 0
        recordDate: recordDate,
        inRecordId: outDetail[0].inRecordId,
        outDetail: detailStr,
        
        conversion_unit: outSelectedSpecData?.specName || outSelectedSpecData?.unit || '', 
        conversion_rate: outSelectedSpecData?.conversion_rate || 1,
        display_out_num: outNum 
    };
    
    try {
        let res = await fetch(`${SUPABASE_URL}/rest/v1/stock_out`, {
            method: 'POST',
            headers: {
                apikey: SUPABASE_KEY, 
                Authorization: `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json', 
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(postData)
        });
        
        if (!res.ok) {
            console.error('出库提交失败，错误响应:', res.status, res.statusText);
            try {
                const errData = await res.json();
                console.error('服务器返回的错误详情:', errData);
            } catch(e) {}
            return showMsg('出库提交失败，请检查数据（请求状态码：' + res.status + '）');
        }
        
        showMsg('出库提交成功');
        try { await updateStockFieldsAfterOut(supplier, goodsName); } catch (e) {}
        closeStockOutForm();
        await loadStockOut();
        await loadStockIn();
        refreshAllStockCache(allStockIn, allStockOut);
    } catch (e) {
        console.error('出库请求异常：', e);
        showMsg('出库请求异常');
    }
}

// ========== 导出/导入/模板、分页、排序、删除 等通用功能 ==========
function downloadStockOutTemplate() {
    const header = ["供应商", "商品名称", "规格", "结算方式", "出库单价", "销售单价", "出库数量", "出库金额", "销售金额", "录入日期"];
    const ws = XLSX.utils.aoa_to_sheet([header]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "出库导入模板");
    XLSX.writeFile(wb, "出库导入模板.xlsx");
}

function exportStockOutExcel() {
    if (filteredStockOut.length === 0) {
        showMsg("暂无数据可导出");
        return;
    }
    let header = ["供应商", "商品名称", "规格", "结算方式", "出库单价", "销售单价", "出库数量", "出库金额", "销售金额", "录入日期"];
    let expData = filteredStockOut.map(item => [
        item.supplier || "", item.goodsName || "", item.spec || "", item.settleType || "",
        item.outPrice || 0, item.salePrice || 0, item.outNum || 0,
        item.outAmount || 0, item.saleAmount || 0, item.recordDate || ""
    ]);
    let ws = XLSX.utils.aoa_to_sheet([header, ...expData]);
    let wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "出库记录");
    XLSX.writeFile(wb, "出库记录.xlsx");
}

// ========== 加载出库列表 ==========
async function loadStockOut() {
    try {
        const fetchAll = await fetch(`${SUPABASE_URL}/rest/v1/stock_out?order=id.desc`, {
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
        });
        const allData = await fetchAll.json();
        allStockOut = allData;
        initOutFilterData();
        window.allStockOut = allData;
        document.getElementById('outTotalCount').textContent = allData.length;
        outCurrentPage = 1;
        filterStockOut();
    } catch (e) {
        showMsg('加载出库记录失败：' + e.message);
    }
}

// ========== 搜索筛选 ==========
function filterStockOut() {
    const supplier = document.getElementById('outFilterSupplierInput')?.value.trim() || '';
    const goodsName = document.getElementById('outFilterGoodsNameInput')?.value.trim() || '';
    const settleType = document.getElementById('outFilterSettleTypeInput')?.value.trim() || '';

    if (!allStockOut || !Array.isArray(allStockOut)) {
        filteredStockOut = [];
    } else {
        filteredStockOut = allStockOut.filter(item => {
            let match = true;
            if (supplier && !(item.supplier || '').toLowerCase().includes(supplier.toLowerCase())) match = false;
            if (goodsName && !(item.goodsName || '').toLowerCase().includes(goodsName.toLowerCase())) match = false;
            if (settleType && !(item.settleType || '').toLowerCase().includes(settleType.toLowerCase())) match = false;
            return match;
        });
    }

    document.getElementById('outSearchCount').textContent = filteredStockOut.length;
    outCurrentPage = 1;
    renderOutPagination();
    renderStockOut();
}

// ========== 排序 ==========
function outSortTable(field) {
    outSortField = field;
    outSortAsc = (outSortField === field) ? !outSortAsc : true;
    filteredStockOut.sort((a, b) => {
        let va = a[outSortField] || '', vb = b[outSortField] || '';
        if (['outPrice', 'outNum', 'outAmount', 'saleAmount', 'salePrice'].includes(outSortField)) {
            va = Number(va) || 0;
            vb = Number(vb) || 0;
            return outSortAsc ? va - vb : vb - va;
        }
        return outSortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    });
    updateOutSortIcon();
    renderStockOut();
}

function updateOutSortIcon() {
    document.querySelectorAll('.outSortIcon').forEach(i => i.innerText = '');
    let idx = Array.from(document.querySelectorAll('.sortable')).findIndex(th => th.onclick?.toString().includes(outSortField));
    if (idx > -1) document.querySelectorAll('.outSortIcon')[idx].innerText = outSortAsc ? '↑' : '↓';
}

// ========== 渲染表格（显示完整规格、出库类型、控制报损金额） ==========
function renderStockOut() {
    let start = (outCurrentPage - 1) * outPageSize;
    let pageData = filteredStockOut.slice(start, start + outPageSize);
    let tb = document.getElementById('stockOutList');
    if (!tb) return;
    tb.innerHTML = '';
    
    pageData.forEach((item, idx) => {
        // 1. 构建完整规格显示（如：份（100克））跟入库一致
        let specDisplay = '-';
        let specName = item.conversion_unit || item.spec || '';
        let rate = Number(item.conversion_rate || 1);
        if (specName && rate > 0) {
            specDisplay = `<div style="display:flex;flex-direction:column;align-items:center;line-height:1.4;">
                <span style="font-weight:bold;font-size:14px;">${specName}</span>
                <span style="font-size:12px;color:#999;">（${rate}克）</span>
            </div>`;
        } else {
            specDisplay = item.spec || '-';
        }

        // 2. 实际出库数量
        let displayNum = item.display_out_num || Math.floor(Number(item.outNum || 0) / (Number(item.conversion_rate || 1)));
        
        // 3. 获取出库类型，控制金额显示
        let outType = item.outType || '-';
        let salePriceDisplay = formatMoney(item.salePrice || 0);
        let saleAmountDisplay = formatMoney(item.saleAmount || 0);
        
        // 即使是老数据，如果类型是报损/赠送，强制显示 0
        if (outType === '报损' || outType === '赠送') {
            salePriceDisplay = '￥0.00';
            saleAmountDisplay = '￥0.00';
        }
        
        let html = `
            <tr>
                <td><input type="checkbox" class="out-item-checkbox" value="${item.id}"></td>
                <td>${start + idx + 1}</td>
                <td>${item.supplier || ''}</td>
                <td>${item.goodsName || ''}</td>
                <td style="text-align:center;">${specDisplay}</td>
                <td>${item.settleType || ''}</td>
                <td>${outType}</td> <!-- 新增：出库类型 -->
                <td>${formatMoney(item.outPrice)}</td>
                <td>${salePriceDisplay}</td> <!-- 销售单价 -->
                <td>${displayNum}</td>
                <td>${formatMoney(item.outAmount)}</td>
                <td>${saleAmountDisplay}</td> <!-- 销售金额 -->
                <td>${item.recordDate || ''}</td>
                <td>
                    <button class="btn btn-danger" onclick="deleteStockOut(${item.id})">删除</button>
                </td>
            </tr>
        `;
        tb.innerHTML += html;
    });
}
// ========== 分页 ==========
function renderOutPagination() {
    outTotalPages = Math.ceil(filteredStockOut.length / outPageSize) || 1;
    document.getElementById('outCurrentPage').textContent = outCurrentPage;
    document.getElementById('outTotalPages').textContent = outTotalPages;

    let pgBox = document.getElementById('outPageNumbers');
    pgBox.innerHTML = '';
    let s = Math.max(1, outCurrentPage - 2);
    let e = Math.min(outTotalPages, s + 4);
    for (let i = s; i <= e; i++) {
        let btn = document.createElement('button');
        btn.className = 'page-btn ' + (i === outCurrentPage ? 'active' : '');
        btn.innerText = i;
        btn.onclick = () => outGoToPage(i);
        pgBox.appendChild(btn);
    }

    let btns = document.querySelectorAll('#stockOut .page-controls .page-btn');
    if (btns.length >= 4) {
        btns[0].disabled = (outCurrentPage === 1);
        btns[1].disabled = (outCurrentPage === 1);
        btns[btns.length - 2].disabled = (outCurrentPage === outTotalPages);
        btns[btns.length - 1].disabled = (outCurrentPage === outTotalPages);
    }
}

function outGoToPage(p) { if (p < 1 || p > outTotalPages) return; outCurrentPage = p; renderOutPagination(); renderStockOut(); }
function outPrevPage() { outGoToPage(outCurrentPage - 1); }
function outNextPage() { outGoToPage(outCurrentPage + 1); }
function changeOutPageSize() { outPageSize = +document.getElementById('outPageSize').value; outCurrentPage = 1; renderOutPagination(); renderStockOut(); }

// ========== 全选 ==========
function outToggleSelectAll() {
    let all = document.getElementById('outSelectAll').checked;
    document.querySelectorAll('.out-item-checkbox').forEach(cb => cb.checked = all);
}

// ========== 单条删除出库 ==========
async function deleteStockOut(id) {
    if (!isCurrentUserAdmin()) {
        showMsg('只有管理员可以删除出库记录');
        return;
    }
    if (!confirm('确定删除？')) return;
    try {
        await fetch(`${SUPABASE_URL}/rest/v1/stock_out?id=eq.${id}`, {
            method: 'DELETE',
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
        });
        showMsg('删除成功');
        loadStockOut();
        loadStockIn();
    } catch (e) {
        showMsg('删除失败');
    }
}

// ========== 批量删除出库 ==========
async function batchDeleteStockOut() {
    if (!isCurrentUserAdmin()) {
        showMsg('只有管理员可以批量删除出库记录');
        return;
    }
    let ids = [];
    document.querySelectorAll('.out-item-checkbox:checked').forEach(cb => ids.push(cb.value));
    if (ids.length === 0) return showMsg('请选择数据');
    if (!confirm(`确定删除${ids.length}条？`)) return;
    for (let id of ids) {
        await fetch(`${SUPABASE_URL}/rest/v1/stock_out?id=eq.${id}`, {
            method: 'DELETE',
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
        });
    }
    showMsg('批量删除成功');
    loadStockOut();
    loadStockIn();
}

// ========== 清空排序、重置搜索 ==========
function clearOutSort() {
    outSortField = '';
    outSortAsc = true;
    updateOutSortIcon();
    loadStockOut();
}

// ============================================================
// ✅ 暴露所有函数到 window 对象（供 HTML onclick 调用）
// ============================================================
(function exposeFunctions() {
    console.log('🔄 开始暴露出库函数到全局...');
    
    const functions = {
        openStockOutForm: openStockOutForm,
        closeStockOutForm: closeStockOutForm,
        submitStockOut: submitStockOut,
        selectOutGoods: selectOutGoods,
        onOutSpecChange: onOutSpecChange,
        checkStockNum: checkStockNum,
        showOutSupList: showOutSupList,
        filterOutSupList: filterOutSupList,
        showOutGoodsList: showOutGoodsList,
        filterOutGoodsList: filterOutGoodsList,
        deleteStockOut: deleteStockOut,
        batchDeleteStockOut: batchDeleteStockOut,
        refreshStockOut: refreshStockOut,
        resetOutSearch: resetOutSearch,
        exportStockOutExcel: exportStockOutExcel,
        downloadStockOutTemplate: downloadStockOutTemplate,
        loadOutGoodsBySupplier: loadOutGoodsBySupplier,
        renderOutSupList: renderOutSupList,
        renderOutGoodsList: renderOutGoodsList,
        renderStockOut: renderStockOut,
        filterStockOut: filterStockOut,
        outGoToPage: outGoToPage,
        outPrevPage: outPrevPage,
        outNextPage: outNextPage,
        changeOutPageSize: changeOutPageSize,
        outToggleSelectAll: outToggleSelectAll,
        outSortTable: outSortTable,
        clearOutSort: clearOutSort,
        showOutFilterList: showOutFilterList,
        filterOutFilterList: filterOutFilterList,
        onOutFilterInput: onOutFilterInput,
        updateTotalStockDisplay: updateTotalStockDisplay,
        updateSalePrice: updateSalePrice,
        getSalePriceByBzStatusAndSpec: getSalePriceByBzStatusAndSpec,
        getPriceFromRecord: getPriceFromRecord,
        loadGoodsUnitBind: loadGoodsUnitBind,
        loadUnitSpecs: loadUnitSpecs,
        loadAllBaseUnits: loadAllBaseUnits,
        updateStockFieldsAfterOut: updateStockFieldsAfterOut
    };
    
    for (const [key, fn] of Object.entries(functions)) {
        window[key] = fn;
    }
    
    console.log('✅ openStockOutForm 类型:', typeof window.openStockOutForm);
    console.log('✅ 出库模块所有函数已暴露到全局');
})();

// ========== 页面初始化加载换算规格数据 ==========
(async function initOutSpecData() {
    try {
        await loadGoodsUnitBind();
        await loadUnitSpecs();
        await loadAllBaseUnits();
        console.log('出库模块规格数据初始化完成');
    } catch (e) {
        console.warn('换算规格数据加载失败（不影响主要功能）：', e);
    }
})();

// ========== 全局点击关闭下拉列表（出库模块） ==========
(function() {
    if (window._stockOutClickOutsideBound) return;
    window._stockOutClickOutsideBound = true;
    document.addEventListener('click', function(e) {
        const supInput = document.getElementById('outSupSearchInput');
        const supList = document.getElementById('outSupListBox');
        if (supList && supList.style.display === 'block') {
            if (supInput && !supInput.contains(e.target) && !supList.contains(e.target)) {
                supList.style.display = 'none';
            }
        }
        const goodsInput = document.getElementById('outGoodsSearchInput');
        const goodsList = document.getElementById('outGoodsListBox');
        if (goodsList && goodsList.style.display === 'block') {
            if (goodsInput && !goodsInput.contains(e.target) && !goodsList.contains(e.target)) {
                goodsList.style.display = 'none';
            }
        }
    });
})();

// ===== 全局点击关闭下拉列表（出库筛选） =====
document.addEventListener('click', function(e) {
    const listIds = [
        'outFilterSupplierList',
        'outFilterGoodsNameList',
        'outFilterSettleTypeList'
    ];
    listIds.forEach(id => {
        const box = document.getElementById(id);
        if (box && !e.target.closest(`#${id}`) && !e.target.closest(`#${id.replace('List', 'Input')}`)) {
            box.style.display = 'none';
        }
    });
});

// 确保 resetOutSearch 也暴露到全局
window.resetOutSearch = resetOutSearch;

console.log('✅ stockout.js 加载完成');
