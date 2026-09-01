// ===================== 入库模块 - 终极速度优化版（原有所有业务逻辑100%保留） =====================
// 全局变量：页面初始化时静默预加载出库数据，彻底消除切换页面阻塞
let allStockOutReadyPromise;

// ========== 入库筛选数据 ==========
let inFilterData = {
    supplier: [],
    goodsName: [],
    settleType: ['线上', '线下']  // 结算方式固定
};

// 页面全局初始化：脚本加载时就后台预拉取出库数据，不用等点击入库按钮
(function initPreLoadOut() {
    allStockOutReadyPromise = (async function () {
        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/stock_out`, {
                headers: {
                    apikey: SUPABASE_KEY,
                    Authorization: `Bearer ${SUPABASE_KEY}`
                }
            });
            if (res.ok) {
                allStockOut = await res.json();
            }
        } catch (err) {
            console.warn("全局预加载出库数据失败，不影响基础功能", err);
        }
    })();
})();

/**
 * 校验：后端ID比对（RPC/接口查询出库表，移除前端数组遍历）
 * @param {number|string} inId
 * @returns {Promise<boolean>}
 */
async function checkInUsedByOut(inId) {
    if (!inId) return false;
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/stock_out?inRecordId=eq.${inId}`, {
            method: 'GET',
            headers: {
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        const list = await res.json();
        return list.length > 0;
    } catch (e) {
        console.error("出库校验异常", e);
        return false;
    }
}

/**
 * 校验：是否存在退货记录
 * @param {number|string} inId
 * @returns {Promise<boolean>}
 */
async function checkInUsedByReturn(inId) {
    if (!inId) return false;
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/return_goods?in_record_id=eq.${inId}`, {
            method: 'GET',
            headers: {
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        const list = await res.json();
        return list.length > 0;
    } catch (e) {
        console.error("退货校验异常", e);
        return false;
    }
}

/**
 * 校验：是否存在出库或退货记录（合并判断）
 * @param {number|string} inId
 * @returns {Promise<boolean>}
 */
async function checkInUsed(inId) {
    const outUsed = await checkInUsedByOut(inId);
    const returnUsed = await checkInUsedByReturn(inId);
    return outUsed || returnUsed;
}

// 刷新入库列表
async function refreshStockIn(){
    await loadStockIn();
}

// ========== 入库筛选下拉 ==========
function initInFilterData() {
    if (!allStockIn || allStockIn.length === 0) return;
    inFilterData.supplier = [...new Set(allStockIn.map(item => item.supplier).filter(s => s))].sort();
    inFilterData.goodsName = [...new Set(allStockIn.map(item => item.goodsName).filter(n => n))].sort();
}

function showInFilterList(type) {
    const listId = `inFilter${capitalize(type)}List`;
    const box = document.getElementById(listId);
    if (!box) return;
    const inputId = `inFilter${capitalize(type)}Input`;
    const input = document.getElementById(inputId);
    const kw = input ? input.value.toLowerCase().trim() : '';
    renderInFilterList(type, kw);
    box.style.display = 'block';
}

function filterInFilterList(type) {
    const inputId = `inFilter${capitalize(type)}Input`;
    const input = document.getElementById(inputId);
    const kw = input.value.toLowerCase().trim();
    renderInFilterList(type, kw);
    const listId = `inFilter${capitalize(type)}List`;
    const box = document.getElementById(listId);
    if (box) box.style.display = 'block';
}

function renderInFilterList(type, keyword = '') {
    const listId = `inFilter${capitalize(type)}List`;
    const box = document.getElementById(listId);
    if (!box) return;
    let data = inFilterData[type] || [];
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
            const inputId = `inFilter${capitalize(type)}Input`;
            document.getElementById(inputId).value = opt;
            box.style.display = 'none';
            filterStockIn();
        };
        box.appendChild(div);
    });
}

function resetInSearch() {
    document.getElementById('inFilterSupplierInput').value = '';
    document.getElementById('inFilterGoodsNameInput').value = '';
    document.getElementById('inFilterSettleTypeInput').value = '';
    document.querySelectorAll('[id^="inFilter"][id$="List"]').forEach(el => el.style.display = 'none');
    filterStockIn();
}

// ========== 入库实时搜索（输入即搜索） ==========
function onInFilterInput() {
    filterStockIn();
    const supplierInput = document.getElementById('inFilterSupplierInput');
    const goodsInput = document.getElementById('inFilterGoodsNameInput');
    const settleInput = document.getElementById('inFilterSettleTypeInput');
    
    if (document.activeElement === supplierInput) {
        renderInFilterList('supplier', supplierInput.value.trim());
        document.getElementById('inFilterSupplierList').style.display = 'block';
    } else if (document.activeElement === goodsInput) {
        renderInFilterList('goodsName', goodsInput.value.trim());
        document.getElementById('inFilterGoodsNameList').style.display = 'block';
    } else if (document.activeElement === settleInput) {
        renderInFilterList('settleType', settleInput.value.trim());
        document.getElementById('inFilterSettleTypeList').style.display = 'block';
    }
}

// ========= 预加载兜底：等待全局初始化的出库请求完成，不再重复发起网络请求 =========
async function preLoadStockOutData() {
    await allStockOutReadyPromise;
}

// 供应商下拉
function showSupList(){
    currSupplierList = [...new Set(allGoods.map(item=>item.supplier).filter(s=>s))];
    renderSupplierList(currSupplierList);
    document.getElementById('supListBox').style.display = 'block';
}

function filterSupplierList(){
    let kw = document.getElementById('supSearchInput').value.toLowerCase();
    let res = currSupplierList.filter(s => s.toLowerCase().includes(kw));
    renderSupplierList(res);
    document.getElementById('supListBox').style.display = 'block';
}

function renderSupplierList(list){
    let box = document.getElementById('supListBox');
    box.innerHTML = '';
    if(list.length === 0){
        box.innerHTML = '<div>无匹配数据</div>';
        return;
    }
    list.forEach(sup=>{
        let div = document.createElement('div');
        div.innerText = sup;
        div.onclick = function(){
            document.getElementById('supSearchInput').value = sup;
            document.getElementById('supListBox').style.display = 'none';
            loadGoodsBySupplier(sup);
        };
        box.appendChild(div);
    });
}

function loadGoodsBySupplier(supplier){
    currGoodsList = allGoods.filter(g => g.supplier === supplier);
    document.getElementById('goodsSearchInput').value = '';
    document.getElementById('curSelectGoodsId').value = '';
    document.getElementById('inSpec').value = '';
    document.getElementById('inSettleType').value = '';
    document.getElementById('inSalePrice').value = '';
    const editId = document.getElementById('inEditId').value;
    if (!editId) {
        document.getElementById('inPrice').value = '';
        document.getElementById('inPrice').disabled = false;
    }
    hideInPriceReminder();
}

// 商品下拉
function showGoodsList(){
    renderGoodsSelectList(currGoodsList);
    document.getElementById('goodsListBox').style.display = 'block';
}

function filterGoodsList(){
    let kw = document.getElementById('goodsSearchInput').value.toLowerCase();
    let res = currGoodsList.filter(g => g.name.toLowerCase().includes(kw));
    renderGoodsSelectList(res);
    document.getElementById('goodsListBox').style.display = 'block';
}

function renderGoodsSelectList(list){
    let box = document.getElementById('goodsListBox');
    box.innerHTML = '';
    if(list.length === 0){
        box.innerHTML = '<div>无匹配数据</div>';
        return;
    }
    list.forEach(goods=>{
        let div = document.createElement('div');
        div.innerText = goods.name;
        div.onclick = function(){
            selectInGoods(goods);
            document.getElementById('goodsListBox').style.display = 'none';
        };
        box.appendChild(div);
    });
}

function selectInGoods(goods, selectedSpecId, isEditMode){
    document.getElementById('goodsSearchInput').value = goods.name;
    document.getElementById('curSelectGoodsId').value = goods.id;
    document.getElementById('inSpec').value = goods.spec || '';
    document.getElementById('inSettleType').value = goods.channel || '';
    
    const salePriceInput = document.getElementById('inSalePrice');
    salePriceInput.value = formatMoney(goods.sale_price);
    salePriceInput.placeholder = '';
    salePriceInput.style.color = '';
    
    const loadSpecs = function() {
        if (!baseUnitList || baseUnitList.length === 0 || !unitSpecList || unitSpecList.length === 0) {
            loadAllBaseUnit().then(() => {
                loadAllUnitSpec().then(() => {
                    loadInUnitSpecs(goods.id, selectedSpecId, goods);
                    setTimeout(() => {
                        const unitSpecSelect = document.getElementById('inUnitSpec');
                        const specId = unitSpecSelect ? unitSpecSelect.value : null;
                        if (goods.channel === '线下') {
                            loadLastInPriceAndRemind(goods, specId);
                        } else if (goods.channel === '线上') {
                            if (specId) {
                                const specPriceMap = unitSpecSelect ? unitSpecSelect._specPriceMap || {} : {};
                                const specPrice = specPriceMap[specId];
                                const priceInput = document.getElementById('inPrice');
                                if (specPrice && specPrice.online_cost !== null && specPrice.online_cost !== undefined) {
                                    priceInput.value = specPrice.online_cost;
                                } else {
                                    priceInput.value = goods.online_cost || 0;
                                }
                            }
                        }
                    }, 300);
                });
            });
        } else {
            loadInUnitSpecs(goods.id, selectedSpecId, goods);
            setTimeout(() => {
                const unitSpecSelect = document.getElementById('inUnitSpec');
                const specId = unitSpecSelect ? unitSpecSelect.value : null;
                if (goods.channel === '线下') {
                    loadLastInPriceAndRemind(goods, specId);
                } else if (goods.channel === '线上') {
                    if (specId) {
                        const specPriceMap = unitSpecSelect ? unitSpecSelect._specPriceMap || {} : {};
                        const specPrice = specPriceMap[specId];
                        const priceInput = document.getElementById('inPrice');
                        if (specPrice && specPrice.online_cost !== null && specPrice.online_cost !== undefined) {
                            priceInput.value = specPrice.online_cost;
                        } else {
                            priceInput.value = goods.online_cost || 0;
                        }
                    }
                }
            }, 300);
        }
    };
    loadSpecs();
    
    let priceInput = document.getElementById('inPrice');
    if(goods.channel === '线上'){
        priceInput.disabled = true;
        hideInPriceReminder();
    }else{
        priceInput.disabled = false;
        if (!isEditMode) {
            priceInput.value = '';
        }
    }
    updateInPriceByDate();
}

// 🔥 新增：加载商品绑定的规格到入库规格下拉框（支持传入选中值和商品信息）
function loadInUnitSpecs(goodsId, selectedSpecId, goods) {
    const select = document.getElementById('inUnitSpec');
    if (!select) return;
    select.innerHTML = '<option value="">请选择规格</option>';
    
    if (!goodsId) {
        select.disabled = true;
        return;
    }
    
    if (!goods) {
        goods = allGoods.find(g => g.id == goodsId);
    }
    
    if (!baseUnitList || baseUnitList.length === 0 || !unitSpecList || unitSpecList.length === 0) {
        loadAllBaseUnit().then(() => {
            loadAllUnitSpec().then(() => {
                loadInUnitSpecs(goodsId, selectedSpecId, goods);
            });
        });
        return;
    }
    
    fetch(`${SUPABASE_URL}/rest/v1/goods_unit_bind?goods_id=eq.${goodsId}`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    })
    .then(res => {
        if (!res.ok) throw new Error('加载失败');
        return res.json();
    })
    .then(bindList => {
        if (!bindList || bindList.length === 0) {
            select.disabled = true;
            select.innerHTML = '<option value="">该商品暂无绑定规格</option>';
            const salePriceInput = document.getElementById('inSalePrice');
            if (goods) {
                salePriceInput.value = formatMoney(goods.sale_price);
                salePriceInput.placeholder = '';
                salePriceInput.style.color = '';
            }
            return;
        }
        
        select.disabled = false;
        
        const specPriceMap = {};
        bindList.forEach(b => {
            if (b.spec_id) {
                specPriceMap[b.spec_id] = {
                    sale_price: b.sale_price,
                    online_cost: b.online_cost
                };
            }
        });
        
        const specIds = bindList.map(b => b.spec_id);
        const baseId = bindList[0]?.base_unit_id;
        const baseItem = baseUnitList.find(b => b.id == baseId);
        
        select._specPriceMap = specPriceMap;
        
        specIds.forEach(specId => {
            const spec = unitSpecList.find(s => s.id == specId);
            if (spec) {
                const option = document.createElement('option');
                option.value = spec.id;
                option.textContent = spec.show_name + '（' + spec.convert_rate + (baseItem ? baseItem.unit_name : '') + '）';
                option.dataset.convertRate = spec.convert_rate;
                select.appendChild(option);
            }
        });
        
        if (selectedSpecId) {
            select.value = selectedSpecId;
            onInUnitSpecChange();
            return;
        }
        
        const specCount = select.options.length - 1;
        
        if (specCount === 0) {
            select.disabled = true;
            select.innerHTML = '<option value="">该商品暂无绑定规格</option>';
            const salePriceInput = document.getElementById('inSalePrice');
            if (goods) {
                salePriceInput.value = formatMoney(goods.sale_price);
                salePriceInput.placeholder = '';
                salePriceInput.style.color = '';
            }
            return;
        } else if (specCount === 1) {
            const firstOption = select.querySelector('option:not([value=""])');
            if (firstOption) {
                select.value = firstOption.value;
                onInUnitSpecChange();
                
                if (goods && goods.channel === '线上') {
                    const priceInput = document.getElementById('inPrice');
                    const specPriceMap = select._specPriceMap || {};
                    const specPrice = specPriceMap[firstOption.value];
                    if (specPrice && specPrice.online_cost !== null && specPrice.online_cost !== undefined) {
                        priceInput.value = specPrice.online_cost;
                    } else {
                        priceInput.value = goods.online_cost || 0;
                    }
                }
                
                if (goods && goods.channel === '线下') {
                    setTimeout(() => {
                        loadLastInPriceAndRemind(goods, firstOption.value);
                    }, 200);
                }
            }
        } else {
            select.value = '';
            const salePriceInput = document.getElementById('inSalePrice');
            if (salePriceInput) {
                salePriceInput.value = '';
                salePriceInput.placeholder = '请选择入库规格';
                salePriceInput.style.color = '#999';
            }
        }
    })
    .catch(err => {
        console.warn('加载入库规格失败:', err);
        select.disabled = true;
        select.innerHTML = '<option value="">加载失败</option>';
        const salePriceInput = document.getElementById('inSalePrice');
        if (goods) {
            salePriceInput.value = formatMoney(goods.sale_price);
            salePriceInput.placeholder = '';
            salePriceInput.style.color = '';
        }
    });
}

// 🔥 入库规格变更时更新销售单价
function onInUnitSpecChange() {
    const select = document.getElementById('inUnitSpec');
    const goodsId = document.getElementById('curSelectGoodsId').value;
    
    if (!select) return;
    
    const salePriceInput = document.getElementById('inSalePrice');
    if (!salePriceInput) return;
    
    const selectedSpecId = select.value;
    const goods = allGoods.find(g => g.id == goodsId);
    if (!goods) return;
    
    const specPriceMap = select._specPriceMap || {};
    
    if (!selectedSpecId || Object.keys(specPriceMap).length === 0) {
        salePriceInput.value = formatMoney(goods.sale_price);
        salePriceInput.placeholder = '';
        salePriceInput.style.color = '';
    } else {
        const specPrice = specPriceMap[selectedSpecId];
        if (specPrice && specPrice.sale_price !== null && specPrice.sale_price !== undefined) {
            salePriceInput.value = formatMoney(specPrice.sale_price);
            salePriceInput.placeholder = '规格价格';
            salePriceInput.style.color = '#1890ff';
        } else {
            salePriceInput.value = formatMoney(goods.sale_price);
            salePriceInput.placeholder = '';
            salePriceInput.style.color = '';
        }
    }
    
    const priceInput = document.getElementById('inPrice');
    if (goods.channel === '线上' && selectedSpecId) {
        const specPrice = specPriceMap[selectedSpecId];
        if (specPrice && specPrice.online_cost !== null && specPrice.online_cost !== undefined) {
            priceInput.value = specPrice.online_cost;
        } else {
            priceInput.value = goods.online_cost || 0;
        }
    }
    
    const isEditMode = document.getElementById('inEditId').value ? true : false;
    if (!isEditMode) {
        if (goods.channel === '线下') {
            loadLastInPriceAndRemind(goods, selectedSpecId);
        }
    }
}

// 日期互斥
function lockExpireDate(){
    let p = document.getElementById('inProduceDate').value;
    if(p) {
        document.getElementById('inExpireDate').value = '';
        updateInPriceByDate();
    }
}

function lockProduceDate(){
    let e = document.getElementById('inExpireDate').value;
    if(e) {
        document.getElementById('inProduceDate').value = '';
        updateInPriceByDate();
    }
}

// ========== 新增：根据日期更新销售价 ==========
async function updateInPriceByDate() {
    const goodsId = document.getElementById('curSelectGoodsId').value;
    const produceDate = document.getElementById('inProduceDate').value;
    const expireDate = document.getElementById('inExpireDate').value;
    const unitSpecSelect = document.getElementById('inUnitSpec');
    
    if (!goodsId) return;
    
    const goods = allGoods.find(g => g.id == goodsId);
    if (!goods) return;
    
    const selectedSpecId = unitSpecSelect ? unitSpecSelect.value : '';
    const specPriceMap = unitSpecSelect ? unitSpecSelect._specPriceMap || {} : {};
    
    let basePrice = goods.sale_price || 0;
    if (selectedSpecId && specPriceMap[selectedSpecId] && specPriceMap[selectedSpecId].sale_price !== null && specPriceMap[selectedSpecId].sale_price !== undefined) {
        basePrice = specPriceMap[selectedSpecId].sale_price;
    }
    
    const salePriceInput = document.getElementById('inSalePrice');
    
    if (produceDate || expireDate) {
        let unitCode = "day";
        if (goods.shelf_life_unit === "年") unitCode = "year";
        if (goods.shelf_life_unit === "个月") unitCode = "month";
        
        const expireResult = calculateExpireDays(goods.shelf_life_num, goods.shelf_life_unit);
        let warnDay = 0;
        if (typeof expireResult === 'string' && expireResult.includes('天')) {
            warnDay = parseInt(expireResult) || 0;
        } else if (typeof expireResult === 'number') {
            warnDay = expireResult;
        } else {
            warnDay = Number(expireResult) || 0;
        }
        
        const bzResult = calcBzStatus(
            produceDate,
            expireDate,
            goods.shelf_life_num || 0,
            unitCode,
            warnDay
        );
        const bzStatus = bzResult.statusText || '正常';
        
        const price = await getSalePriceByBzStatus(goodsId, bzStatus, basePrice);
        
        if (price === null || price === undefined) {
            salePriceInput.value = '';
            salePriceInput.placeholder = '价格未录入';
            salePriceInput.style.color = '#ff6b6b';
            return;
        } else {
            basePrice = price;
        }
    }
    
    salePriceInput.value = formatMoney(basePrice);
    salePriceInput.placeholder = (selectedSpecId && specPriceMap[selectedSpecId] && specPriceMap[selectedSpecId].sale_price !== null && specPriceMap[selectedSpecId].sale_price !== undefined) ? '规格价格' : '';
    salePriceInput.style.color = (selectedSpecId && specPriceMap[selectedSpecId] && specPriceMap[selectedSpecId].sale_price !== null && specPriceMap[selectedSpecId].sale_price !== undefined) ? '#1890ff' : '';
}

// ========== 新增：绑定日期事件 ==========
function bindInDateEvents() {
    const produceInput = document.getElementById('inProduceDate');
    const expireInput = document.getElementById('inExpireDate');
    if (produceInput) {
        produceInput.addEventListener('change', updateInPriceByDate);
    }
    if (expireInput) {
        expireInput.addEventListener('change', updateInPriceByDate);
    }
}

// ============================================================
// ========== 入库单价自动填充与提醒功能 ==========
// ============================================================

/**
 * 获取商品最近一次入库单价（通用）- 按 unit_spec_id 精确匹配
 * @param {string} supplier - 供应商
 * @param {string} goodsName - 商品名称
 * @param {string} unitSpecId - 单位规格ID（必须）
 */
async function getLastInPrice(supplier, goodsName, unitSpecId) {
    try {
        if (!unitSpecId) {
            console.warn('getLastInPrice: 未传入 unitSpecId，无法匹配');
            return null;
        }
        
        const encodedSupplier = encodeURIComponent(supplier);
        const encodedGoodsName = encodeURIComponent(goodsName);
        
        let url = `${SUPABASE_URL}/rest/v1/stock_in?supplier=eq.${encodedSupplier}&goodsName=eq.${encodedGoodsName}&unit_spec_id=eq.${unitSpecId}`;
        url += `&order=record_date.desc&limit=1`;
        
        const res = await fetch(url, {
            headers: {
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${SUPABASE_KEY}`
            }
        });
        const data = await res.json();
        if (data && data.length > 0 && data[0].in_price) {
            return {
                price: data[0].in_price,
                recordDate: data[0].record_date,
                inNum: data[0].in_num
            };
        }
        return null;
    } catch (e) {
        console.warn('获取最近入库单价失败:', e);
        return null;
    }
}

/**
 * 获取最近入库单价（排除自身ID，用于编辑时）- 按 unit_spec_id 精确匹配
 * @param {string} supplier - 供应商
 * @param {string} goodsName - 商品名称
 * @param {string} excludeId - 排除的入库记录ID
 * @param {string} unitSpecId - 单位规格ID（必须）
 */
async function getLastInPriceExcludeSelf(supplier, goodsName, excludeId, unitSpecId) {
    try {
        if (!unitSpecId) {
            console.warn('getLastInPriceExcludeSelf: 未传入 unitSpecId，无法匹配');
            return null;
        }
        
        const encodedSupplier = encodeURIComponent(supplier);
        const encodedGoodsName = encodeURIComponent(goodsName);
        
        let url = `${SUPABASE_URL}/rest/v1/stock_in?supplier=eq.${encodedSupplier}&goodsName=eq.${encodedGoodsName}&unit_spec_id=eq.${unitSpecId}&id=neq.${excludeId}`;
        url += `&order=record_date.desc&limit=1`;
        
        const res = await fetch(url, {
            headers: {
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${SUPABASE_KEY}`
            }
        });
        const data = await res.json();
        if (data && data.length > 0 && data[0].in_price) {
            return {
                price: data[0].in_price,
                recordDate: data[0].record_date,
                inNum: data[0].in_num
            };
        }
        return null;
    } catch (e) {
        console.warn('获取最近入库单价（排除自身）失败:', e);
        return null;
    }
}

/**
 * 加载最近入库单价并显示提醒（按 unit_spec_id 精确匹配，如果没有规格则按供应商+商品名匹配）
 * @param {object} goods - 商品对象
 * @param {string} specId - 规格ID（可选）
 */
async function loadLastInPriceAndRemind(goods, specId) {
    const supplier = document.getElementById('supSearchInput').value.trim();
    const goodsName = goods.name;
    const editId = document.getElementById('inEditId').value;
    
    if (!supplier || !goodsName) return;
    
    const priceInput = document.getElementById('inPrice');
    let lastRecord = null;
    
    if (specId) {
        if (editId) {
            lastRecord = await getLastInPriceExcludeSelf(supplier, goodsName, editId, specId);
        } else {
            lastRecord = await getLastInPrice(supplier, goodsName, specId);
        }
    } else {
        try {
            const encodedSupplier = encodeURIComponent(supplier);
            const encodedGoodsName = encodeURIComponent(goodsName);
            
            let url = `${SUPABASE_URL}/rest/v1/stock_in?supplier=eq.${encodedSupplier}&goodsName=eq.${encodedGoodsName}`;
            if (editId) {
                url += `&id=neq.${editId}`;
            }
            url += `&settleType=eq.线下`;
            url += `&order=record_date.desc&limit=1`;
            
            const res = await fetch(url, {
                headers: {
                    apikey: SUPABASE_KEY,
                    Authorization: `Bearer ${SUPABASE_KEY}`
                }
            });
            const data = await res.json();
            if (data && data.length > 0 && data[0].in_price) {
                lastRecord = {
                    price: data[0].in_price,
                    recordDate: data[0].record_date,
                    inNum: data[0].in_num
                };
            }
        } catch (e) {
            console.warn('获取最近入库单价失败:', e);
        }
    }
    
    if (lastRecord && lastRecord.price > 0) {
        if (!editId) {
            priceInput.value = lastRecord.price;
        }
        showInPriceReminder(lastRecord.price, lastRecord.recordDate);
    } else {
        if (!editId) {
            priceInput.value = '';
        }
        showNoHistoryReminder();
    }
}

/**
 * 显示入库单价提醒（有历史记录）
 */
function showInPriceReminder(lastPrice, lastDate) {
    const reminderEl = document.getElementById('inPriceReminder');
    if (!reminderEl) return;
    
    const formattedDate = lastDate ? new Date(lastDate).toISOString().split('T')[0] : '未知日期';
    const formattedPrice = formatMoney(lastPrice);
    reminderEl.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px;">
            <span style="color:#ff6b6b; font-weight:bold;">⚠️ 调用的是上次入库单价，请确认！</span>
        </div>
        <div style="color:#999; font-size:13px; margin-top:4px;">
            上次入库价：<strong style="color:#333;">${formattedPrice}</strong>
            （录入日期：${formattedDate}）
        </div>
    `;
    reminderEl.style.display = 'inline-block';
    reminderEl.style.textAlign = 'center';
    reminderEl.style.position = 'relative';
    reminderEl.style.left = '50%';
    reminderEl.style.transform = 'translateX(-50%)';
    reminderEl.style.marginTop = '4px';
    reminderEl.style.background = '#fff3cd';
    reminderEl.style.border = '1px solid #ffc107';
    reminderEl.style.borderRadius = '4px';
    reminderEl.style.padding = '6px 16px';
    reminderEl.style.fontSize = '14px';
    reminderEl.style.borderTop = 'none';
    reminderEl.style.boxShadow = '0 2px 4px rgba(0,0,0,0.08)';
    
    const arrowEl = document.createElement('div');
    arrowEl.style.cssText = `
        position: absolute;
        top: -10px;
        left: 50%;
        transform: translateX(-50%);
        width: 0;
        height: 0;
        border-left: 10px solid transparent;
        border-right: 10px solid transparent;
        border-bottom: 10px solid #ffc107;
    `;
    reminderEl.appendChild(arrowEl);
}

/**
 * 显示无历史记录提示
 */
function showNoHistoryReminder() {
    const reminderEl = document.getElementById('inPriceReminder');
    if (!reminderEl) return;
    
    reminderEl.innerHTML = `
        ℹ️ <span style="color:#17a2b8;">该商品暂无入库记录，请手动输入入库单价</span>
    `;
    reminderEl.style.display = 'inline-block';
    reminderEl.style.textAlign = 'center';
    reminderEl.style.position = 'relative';
    reminderEl.style.left = '50%';
    reminderEl.style.transform = 'translateX(-50%)';
    reminderEl.style.marginTop = '4px';
    reminderEl.style.background = '#d1ecf1';
    reminderEl.style.border = '1px solid #17a2b8';
    reminderEl.style.borderRadius = '4px';
    reminderEl.style.padding = '6px 16px';
    reminderEl.style.fontSize = '14px';
    reminderEl.style.borderTop = 'none';
    reminderEl.style.boxShadow = '0 2px 4px rgba(0,0,0,0.08)';
    
    const arrowEl = document.createElement('div');
    arrowEl.style.cssText = `
        position: absolute;
        top: -10px;
        left: 50%;
        transform: translateX(-50%);
        width: 0;
        height: 0;
        border-left: 10px solid transparent;
        border-right: 10px solid transparent;
        border-bottom: 10px solid #17a2b8;
    `;
    reminderEl.appendChild(arrowEl);
}

/**
 * 隐藏入库单价提醒
 */
function hideInPriceReminder() {
    const reminderEl = document.getElementById('inPriceReminder');
    if (reminderEl) {
        reminderEl.style.display = 'none';
        reminderEl.innerHTML = '';
        reminderEl.style.position = '';
        reminderEl.style.left = '';
        reminderEl.style.transform = '';
        reminderEl.style.marginTop = '';
        reminderEl.style.background = '';
        reminderEl.style.border = '';
        reminderEl.style.borderRadius = '';
        reminderEl.style.padding = '';
        reminderEl.style.fontSize = '';
        reminderEl.style.borderTop = '';
        reminderEl.style.boxShadow = '';
        while (reminderEl.firstChild) {
            reminderEl.removeChild(reminderEl.firstChild);
        }
    }
}

/**
 * 显示价格一致的提醒（绿色）
 */
function showPriceConsistentReminder(lastPrice, lastDate) {
    const reminderEl = document.getElementById('inPriceReminder');
    if (!reminderEl) return;
    
    const formattedDate = lastDate ? new Date(lastDate).toISOString().split('T')[0] : '未知日期';
    const formattedPrice = formatMoney(lastPrice);
    reminderEl.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px;">
            <span style="color:#28a745; font-weight:bold;">✅ 入库单价与上次一致</span>
        </div>
        <div style="color:#999; font-size:13px; margin-top:4px;">
            上次入库价：<strong style="color:#333;">${formattedPrice}</strong>
            （${formattedDate}）
        </div>
    `;
    reminderEl.style.display = 'inline-block';
    reminderEl.style.textAlign = 'center';
    reminderEl.style.position = 'relative';
    reminderEl.style.left = '50%';
    reminderEl.style.transform = 'translateX(-50%)';
    reminderEl.style.marginTop = '4px';
    reminderEl.style.background = '#d4edda';
    reminderEl.style.border = '1px solid #28a745';
    reminderEl.style.borderRadius = '4px';
    reminderEl.style.padding = '6px 16px';
    reminderEl.style.fontSize = '14px';
    reminderEl.style.borderTop = 'none';
    reminderEl.style.boxShadow = '0 2px 4px rgba(0,0,0,0.08)';
    
    const arrowEl = document.createElement('div');
    arrowEl.style.cssText = `
        position: absolute;
        top: -10px;
        left: 50%;
        transform: translateX(-50%);
        width: 0;
        height: 0;
        border-left: 10px solid transparent;
        border-right: 10px solid transparent;
        border-bottom: 10px solid #28a745;
    `;
    reminderEl.appendChild(arrowEl);
}

/**
 * 显示价格变更的提醒（红色）
 */
function showPriceChangedReminder(lastPrice, currentPrice, lastDate) {
    const reminderEl = document.getElementById('inPriceReminder');
    if (!reminderEl) return;
    
    const formattedDate = lastDate ? new Date(lastDate).toISOString().split('T')[0] : '未知日期';
    const formattedLastPrice = formatMoney(lastPrice);
    const formattedCurrentPrice = formatMoney(currentPrice);
    reminderEl.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px;">
            <span style="color:#dc3545; font-weight:bold;">⚠️ 入库单价已变更，请确认！</span>
        </div>
        <div style="color:#999; font-size:13px; margin-top:4px;">
            上次入库价：<strong style="color:#dc3545;">${formattedLastPrice}</strong>
            → 当前价：<strong style="color:#007bff;">${formattedCurrentPrice}</strong>
            （上次日期：${formattedDate}）
        </div>
    `;
    reminderEl.style.display = 'inline-block';
    reminderEl.style.textAlign = 'center';
    reminderEl.style.position = 'relative';
    reminderEl.style.left = '50%';
    reminderEl.style.transform = 'translateX(-50%)';
    reminderEl.style.marginTop = '4px';
    reminderEl.style.background = '#f8d7da';
    reminderEl.style.border = '1px solid #dc3545';
    reminderEl.style.borderRadius = '4px';
    reminderEl.style.padding = '6px 16px';
    reminderEl.style.fontSize = '14px';
    reminderEl.style.borderTop = 'none';
    reminderEl.style.boxShadow = '0 2px 4px rgba(0,0,0,0.08)';
    
    const arrowEl = document.createElement('div');
    arrowEl.style.cssText = `
        position: absolute;
        top: -10px;
        left: 50%;
        transform: translateX(-50%);
        width: 0;
        height: 0;
        border-left: 10px solid transparent;
        border-right: 10px solid transparent;
        border-bottom: 10px solid #dc3545;
    `;
    reminderEl.appendChild(arrowEl);
}

// ========== 绑定入库单价输入事件 ==========
function bindInPriceEvents() {
    const priceInput = document.getElementById('inPrice');
    if (!priceInput) return;
    
    priceInput.removeEventListener('input', onPriceInputChange);
    priceInput.addEventListener('input', onPriceInputChange);
}

function onPriceInputChange() {
    const currentPrice = parseFloat(this.value);
    if (isNaN(currentPrice) || currentPrice <= 0) {
        const supplier = document.getElementById('supSearchInput').value.trim();
        const goodsName = document.getElementById('goodsSearchInput').value.trim();
        if (supplier && goodsName) {
            const goods = currGoodsList.find(g => g.name === goodsName);
            if (goods) {
                const unitSpecSelect = document.getElementById('inUnitSpec');
                const specId = unitSpecSelect ? unitSpecSelect.value : null;
                loadLastInPriceAndRemind(goods, specId);
            }
        }
        return;
    }
    
    const supplier = document.getElementById('supSearchInput').value.trim();
    const goodsName = document.getElementById('goodsSearchInput').value.trim();
    const editId = document.getElementById('inEditId').value;
    
    if (supplier && goodsName) {
        const unitSpecSelect = document.getElementById('inUnitSpec');
        const unitSpecId = unitSpecSelect ? unitSpecSelect.value : null;
        
        if (!unitSpecId) {
            (async function() {
                try {
                    const encodedSupplier = encodeURIComponent(supplier);
                    const encodedGoodsName = encodeURIComponent(goodsName);
                    let url = `${SUPABASE_URL}/rest/v1/stock_in?supplier=eq.${encodedSupplier}&goodsName=eq.${encodedGoodsName}`;
                    if (editId) url += `&id=neq.${editId}`;
                    url += `&settleType=eq.线下&order=record_date.desc&limit=1`;
                    const res = await fetch(url, {
                        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
                    });
                    const data = await res.json();
                    if (data && data.length > 0 && data[0].in_price) {
                        const lastRecord = {
                            price: data[0].in_price,
                            recordDate: data[0].record_date,
                            inNum: data[0].in_num
                        };
                        if (Math.abs(lastRecord.price - currentPrice) < 0.01) {
                            showPriceConsistentReminder(lastRecord.price, lastRecord.recordDate);
                        } else {
                            showPriceChangedReminder(lastRecord.price, currentPrice, lastRecord.recordDate);
                        }
                    }
                } catch (e) {
                    console.warn('获取最近入库单价失败:', e);
                }
            })();
            return;
        }
        
        let lastRecordPromise;
        if (editId) {
            lastRecordPromise = getLastInPriceExcludeSelf(supplier, goodsName, editId, unitSpecId);
        } else {
            lastRecordPromise = getLastInPrice(supplier, goodsName, unitSpecId);
        }
        
        lastRecordPromise.then(lastRecord => {
            if (lastRecord && lastRecord.price > 0) {
                if (Math.abs(lastRecord.price - currentPrice) < 0.01) {
                    showPriceConsistentReminder(lastRecord.price, lastRecord.recordDate);
                } else {
                    showPriceChangedReminder(lastRecord.price, currentPrice, lastRecord.recordDate);
                }
            }
        });
    }
}

// 打开添加入库弹窗（异步校验）
async function openStockInForm(id=null){
    document.getElementById('supSearchInput').value = '';
    document.getElementById('goodsSearchInput').value = '';
    document.getElementById('curSelectGoodsId').value = '';
    document.getElementById('inSpec').value = '';
    document.getElementById('inSettleType').value = '';
    document.getElementById('inSalePrice').value = '';
    document.getElementById('inNum').value = '';
    document.getElementById('inPrice').value = '';
    document.getElementById('inPrice').disabled = false;
    document.getElementById('inRecordDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('inProduceDate').value = '';
    document.getElementById('inExpireDate').value = '';
    const unitSpecSelect = document.getElementById('inUnitSpec');
    if (unitSpecSelect) {
        unitSpecSelect.innerHTML = '<option value="">请选择规格</option>';
        unitSpecSelect.disabled = true;
    }
    hideInPriceReminder();
    const salePriceInput = document.getElementById('inSalePrice');
    if (salePriceInput) {
        salePriceInput.placeholder = '';
        salePriceInput.style.color = '';
    }
    document.getElementById('supListBox').style.display = 'none';
    document.getElementById('goodsListBox').style.display = 'none';

    if (id && await checkInUsed(id)) {
        showMsg('该入库记录已生成出库或退货单据，禁止编辑！');
        return;
    }
    document.getElementById('inEditId').value = id || '';
    document.getElementById('stockInFormTitle').innerText = id ? '编辑入库单据' : '添加入库单据';
    
    if(id){
        let item = allStockIn.find(x=>x.id === id);
        if(!item) return;
        
        document.getElementById('supSearchInput').value = item.supplier;
        loadGoodsBySupplier(item.supplier);
        
        setTimeout(()=>{
            let targetGoods = currGoodsList.find(g => g.name === item.goodsName);
            if(targetGoods){
                document.getElementById('goodsSearchInput').value = targetGoods.name;
                document.getElementById('curSelectGoodsId').value = targetGoods.id;
                document.getElementById('inSpec').value = targetGoods.spec || '';
                document.getElementById('inSettleType').value = targetGoods.channel || '';
                
                const selectedSpecId = item.unit_spec_id || null;
                
                const loadSpecs = function() {
                    if (!baseUnitList || baseUnitList.length === 0 || !unitSpecList || unitSpecList.length === 0) {
                        loadAllBaseUnit().then(() => {
                            loadAllUnitSpec().then(() => {
                                loadInUnitSpecs(targetGoods.id, selectedSpecId, targetGoods);
                                setTimeout(() => {
                                    if (targetGoods.channel === '线下') {
                                        loadLastInPriceAndRemind(targetGoods, selectedSpecId);
                                    }
                                }, 300);
                            });
                        });
                    } else {
                        loadInUnitSpecs(targetGoods.id, selectedSpecId, targetGoods);
                        setTimeout(() => {
                            if (targetGoods.channel === '线下') {
                                loadLastInPriceAndRemind(targetGoods, selectedSpecId);
                            }
                        }, 300);
                    }
                };
                loadSpecs();
                
                document.getElementById('inPrice').value = item.in_price || '';
                document.getElementById('inNum').value = item.in_num;
                document.getElementById('inRecordDate').value = item.record_date;
                document.getElementById('inProduceDate').value = item.produce_date || '';
                document.getElementById('inExpireDate').value = item.expire_date || '';
                
                if (targetGoods.sale_price) {
                    document.getElementById('inSalePrice').value = formatMoney(targetGoods.sale_price);
                }
                
                let priceInput = document.getElementById('inPrice');
                if (targetGoods.channel === '线上') {
                    priceInput.disabled = true;
                    priceInput.value = item.in_price || '';
                    hideInPriceReminder();
                } else {
                    priceInput.disabled = false;
                    priceInput.value = item.in_price || '';
                    const unitSpecSelect = document.getElementById('inUnitSpec');
                    const specId = unitSpecSelect ? unitSpecSelect.value : null;
                    loadLastInPriceAndRemind(targetGoods, specId);
                }
                
                setTimeout(() => {
                    updateInPriceByDate();
                }, 50);
            }
        },100);
    }
    bindInDateEvents();
    bindInPriceEvents();
    document.getElementById('stockInModal').style.display = 'block';
}

function closeStockInForm(){
    document.getElementById('stockInModal').style.display = 'none';
}

// 提交入库
async function submitStockIn(){
    let editId = document.getElementById('inEditId').value;
    let supplier = document.getElementById('supSearchInput').value.trim();
    let goodsName = document.getElementById('goodsSearchInput').value.trim();
    let goodsId = document.getElementById('curSelectGoodsId').value;
    let spec = document.getElementById('inSpec').value;
    let settleType = document.getElementById('inSettleType').value;
    let salePriceText = document.getElementById('inSalePrice').value;
    let salePrice = 0;
    if (salePriceText && salePriceText.trim() !== '') {
        const cleaned = salePriceText.replace('￥', '').trim();
        salePrice = parseFloat(cleaned) || 0;
    }
    let inNum = document.getElementById('inNum').value;
    let inPrice = document.getElementById('inPrice').value;
    let recordDate = document.getElementById('inRecordDate').value;
    let produceDate = document.getElementById('inProduceDate').value;
    let expireDate = document.getElementById('inExpireDate').value;
    let unitSpecId = document.getElementById('inUnitSpec').value || null;

    if(!supplier) return alert('请选择供应商');
    if(!goodsName || !goodsId) return alert('请选择商品');
    if(!inNum || +inNum < 1) return alert('入库数量必须大于0');
    if(!recordDate) return alert('请选择录入日期');
    
    const unitSpecSelect = document.getElementById('inUnitSpec');
    if (unitSpecSelect && unitSpecSelect.options.length > 1) {
        const selectedValue = unitSpecSelect.value;
        if (!selectedValue || selectedValue === '') {
            return alert('请选择入库规格');
        }
    }
    
    if(settleType === '线下'){
        if(inPrice === '' || isNaN(+inPrice) || +inPrice < 0){
            return alert('线下商品必须填写入库单价');
        }
    }
    
    if (produceDate && expireDate) {
        return alert('生产日期和到期日期不能同时填写');
    }

    let targetGoods = allGoods.find(g => g.id == goodsId);
    let finalInPrice = 0;
    let baseNum = 0;
    
    if (unitSpecId) {
        const spec = unitSpecList.find(s => s.id == Number(unitSpecId));
        if (spec) {
            const convertRate = spec.convert_rate || 1;
            baseNum = +inNum * convertRate;
        } else {
            baseNum = +inNum;
        }
    } else {
        baseNum = +inNum;
    }
    
    if(settleType === '线上'){
        if (unitSpecId) {
            try {
                const bindRes = await fetch(`${SUPABASE_URL}/rest/v1/goods_unit_bind?goods_id=eq.${goodsId}&spec_id=eq.${unitSpecId}`, {
                    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
                });
                const bindList = await bindRes.json();
                if (bindList && bindList.length > 0 && bindList[0].online_cost !== null && bindList[0].online_cost !== undefined) {
                    finalInPrice = Number(bindList[0].online_cost);
                } else {
                    finalInPrice = targetGoods ? Number(targetGoods.online_cost) : 0;
                }
            } catch (e) {
                console.warn('获取规格线上成本价失败，使用商品默认值:', e);
                finalInPrice = targetGoods ? Number(targetGoods.online_cost) : 0;
            }
        } else {
            finalInPrice = targetGoods ? Number(targetGoods.online_cost) : 0;
        }
    }else{
        finalInPrice = +inPrice;
    }

    let invoiceStatus = settleType === '线下' ? '未开票' : '';

    let postData = {
        supplier: supplier,
        goodsName: goodsName,
        spec: spec || null,
        settleType: settleType,
        sale_price: salePrice,
        in_price: finalInPrice,
        in_num: +inNum,
        base_num: baseNum,
        record_date: recordDate,
        produce_date: produceDate || null,
        expire_date: expireDate || null,
        invoice_status: invoiceStatus,
        unit_spec_id: unitSpecId
    };

    try {
        let res;
        const headers = {
            apikey:SUPABASE_KEY,
            Authorization:`Bearer ${SUPABASE_KEY}`,
            'Content-Type':'application/json',
            'Prefer':'return=representation'
        };

        if(editId){
            delete postData.invoice_status;
            res = await fetch(`${SUPABASE_URL}/rest/v1/stock_in?id=eq.${editId}`,{
                method:'PATCH',
                headers,
                body:JSON.stringify(postData)
            });
        }else{
            res = await fetch(`${SUPABASE_URL}/rest/v1/stock_in`,{
                method:'POST',
                headers,
                body:JSON.stringify(postData)
            });
        }

// 提交入库成功后
if (res.status >= 200 && res.status < 300) {
    try { await res.json(); } catch {}
    
    // ✅ 入库成功后更新库存字段
    try {
        await updateStockFields(supplier, goodsName);
        console.log('✅ updateStockFields 执行完成');
    } catch (e) {
        console.error('❌ updateStockFields 执行失败:', e);
    }
    
    // ✅ 入库成功后，更新 price_temp_state 表
    try {
        await updatePriceTempState(goodsId, unitSpecId, salePrice);
    } catch (e) {
        console.warn('更新价格表失败（不影响入库）：', e);
    }
    
    showMsg(editId ? '编辑成功' : '入库成功');
    closeStockInForm();
    await loadStockIn();
    return;
}
        throw new Error('请求失败');
    } catch (e) {
        showMsg('入库提交失败');
    }
}
// ========== 更新价格临时表 ==========
async function updatePriceTempState(goodsId, specId, salePrice) {
    if (!goodsId) return;
    
    // 如果没有 salePrice，尝试从商品信息获取
    if (!salePrice || salePrice === 0) {
        const goods = allGoods.find(g => g.id == goodsId);
        if (goods) {
            // 如果有规格ID，从 goods_unit_bind 获取价格
            if (specId) {
                try {
                    const bindRes = await fetch(`${SUPABASE_URL}/rest/v1/goods_unit_bind?goods_id=eq.${goodsId}&spec_id=eq.${specId}`, {
                        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
                    });
                    const bindData = await bindRes.json();
                    if (bindData && bindData.length > 0 && bindData[0].sale_price) {
                        salePrice = bindData[0].sale_price;
                    }
                } catch (e) {
                    console.warn('获取规格价格失败:', e);
                }
            }
            // 如果还是没有，使用商品默认价格
            if (!salePrice || salePrice === 0) {
                salePrice = goods.sale_price || 0;
            }
        }
    }
    
    // 如果 salePrice 为 0 或 null，不更新
    if (!salePrice || salePrice === 0) {
        console.log('价格为空，不更新 price_temp_state');
        return;
    }
    
    // 查询是否已存在记录
    let query = `${SUPABASE_URL}/rest/v1/price_temp_state?goods_id=eq.${goodsId}`;
    if (specId) {
        query += `&spec_id=eq.${specId}`;
    } else {
        query += `&spec_id=eq.0`;
    }
    
    try {
        const checkRes = await fetch(query, {
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
        });
        const existingData = await checkRes.json();
        
        if (existingData && existingData.length > 0) {
            // 更新现有记录 - 只更新 sale_price，保留折扣价
            const updateData = {
                sale_price: salePrice,
                updated_at: new Date().toISOString()
            };
            await fetch(`${SUPABASE_URL}/rest/v1/price_temp_state?id=eq.${existingData[0].id}`, {
                method: 'PATCH',
                headers: {
                    apikey: SUPABASE_KEY,
                    Authorization: `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updateData)
            });
            console.log(`✅ 更新价格记录: goods_id=${goodsId}, spec_id=${specId || 0}, price=${salePrice}`);
        } else {
            // 插入新记录
            const insertData = {
                goods_id: goodsId,
                spec_id: specId || 0,
                sale_price: salePrice,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            await fetch(`${SUPABASE_URL}/rest/v1/price_temp_state`, {
                method: 'POST',
                headers: {
                    apikey: SUPABASE_KEY,
                    Authorization: `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(insertData)
            });
            console.log(`✅ 新增价格记录: goods_id=${goodsId}, spec_id=${specId || 0}, price=${salePrice}`);
        }
    } catch (e) {
        console.error('更新价格表失败:', e);
    }
}

// ========== 入库后更新库存字段 ==========
async function updateStockFields(supplier, goodsName) {
    try {
        console.log('🔄 开始更新库存字段:', supplier, goodsName);
        
        // 1. 获取该商品的所有入库记录
        const encodedSupplier = encodeURIComponent(supplier);
        const encodedGoodsName = encodeURIComponent(goodsName);
        
        const inRes = await fetch(`${SUPABASE_URL}/rest/v1/stock_in?supplier=eq.${encodedSupplier}&goodsName=eq.${encodedGoodsName}`, {
            headers: { 
                apikey: SUPABASE_KEY, 
                Authorization: `Bearer ${SUPABASE_KEY}` 
            }
        });
        const allInRecords = await inRes.json();
        
        if (!allInRecords || allInRecords.length === 0) {
            console.log('❌ 没有找到入库记录');
            return;
        }
        
        console.log('📦 找到入库记录:', allInRecords);
        
        // 2. 获取该商品的所有出库记录
        const outRes = await fetch(`${SUPABASE_URL}/rest/v1/stock_out?supplier=eq.${encodedSupplier}&goodsName=eq.${encodedGoodsName}`, {
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
        });
        const allOutRecords = await outRes.json() || [];
        
        // 3. 获取该商品的所有退货记录
        const returnRes = await fetch(`${SUPABASE_URL}/rest/v1/return_goods?supplier=eq.${encodedSupplier}&goodsName=eq.${encodedGoodsName}`, {
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
        });
        const allReturnRecords = await returnRes.json() || [];
        
        // 4. 计算每个批次的剩余库存和总库存
        let totalStockSum = 0;
        
        for (const record of allInRecords) {
            // 计算该批次已出库数量
            const outTotal = allOutRecords
                .filter(out => out.inRecordId === record.id)
                .reduce((sum, out) => sum + (out.outNum || 0), 0);
            
            // 计算该批次已退货数量
            const returnTotal = allReturnRecords
                .filter(ret => ret.in_record_id === record.id)
                .reduce((sum, ret) => sum + (ret.return_num || 0), 0);
            
            // ✅ 使用 base_num（最小计量单位），如果为 NULL 则使用 in_num
            const baseNum = record.base_num || record.in_num || 0;
            const batchRemain = Math.max(0, baseNum - outTotal - returnTotal);
            
            console.log(`📊 批次 ${record.id}: base_num=${baseNum}, out=${outTotal}, return=${returnTotal}, remain=${batchRemain}`);
            
            // ✅ 更新该记录的 batch_stock
            const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/stock_in?id=eq.${record.id}`, {
                method: 'PATCH',
                headers: {
                    apikey: SUPABASE_KEY,
                    Authorization: `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ batch_stock: batchRemain })
            });
            
            if (updateRes.ok) {
                console.log(`✅ 批次 ${record.id} batch_stock 更新为 ${batchRemain}`);
            } else {
                console.error(`❌ 批次 ${record.id} 更新失败:`, await updateRes.text());
            }
            
            totalStockSum += batchRemain;
        }
        
        console.log('📊 总库存:', totalStockSum);
        
        // 5. 更新该商品所有记录的 total_stock
        for (const record of allInRecords) {
            const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/stock_in?id=eq.${record.id}`, {
                method: 'PATCH',
                headers: {
                    apikey: SUPABASE_KEY,
                    Authorization: `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ total_stock: totalStockSum })
            });
            
            if (updateRes.ok) {
                console.log(`✅ 批次 ${record.id} total_stock 更新为 ${totalStockSum}`);
            } else {
                console.error(`❌ 批次 ${record.id} total_stock 更新失败:`, await updateRes.text());
            }
        }
        
        console.log(`✅ 库存字段更新完成: 总库存=${totalStockSum}`);
    } catch (e) {
        console.error('❌ 更新库存字段失败:', e);
        throw e;
    }
}
// 下载导入模板
function downloadStockInTemplate(){
    const header = ["供应商","商品名称","规格","结算方式","销售单价","入库单价","入库数量","录入日期","生产日期","到期日期"];
    const ws = XLSX.utils.aoa_to_sheet([header]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "入库导入模板");
    XLSX.writeFile(wb, "入库导入模板.xlsx");
}

// 导出Excel
function exportStockInExcel(){
    try {
        console.log('🚀 开始导出入库记录');
        let dataToExport = filteredStockIn && filteredStockIn.length > 0 ? filteredStockIn : allStockIn;
        if(!dataToExport || dataToExport.length === 0){
            showMsg("暂无数据可导出");
            return;
        }
        console.log(`📊 共 ${dataToExport.length} 条数据待导出`);

        let validData = dataToExport.filter(item => item && typeof item === 'object' && Object.keys(item).length > 0);
        if(validData.length === 0){
            showMsg("数据格式异常，无法导出");
            return;
        }

        let header = ["供应商","商品名称","规格","结算方式","销售单价","入库单价","入库数量","录入日期","生产日期","到期日期"];
        let expData = validData.map(item=>[
            item.supplier||"",
            item.goodsName||"",
            item.spec||"",
            item.settleType||"",
            item.sale_price||0,
            item.in_price||0,
            item.in_num||0,
            item.record_date||"",
            item.produce_date||"",
            item.expire_date||""
        ]);
        
        console.log('📝 开始生成 Excel 工作簿');
        let ws = XLSX.utils.aoa_to_sheet([header,...expData]);
        let wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "入库记录");
        console.log('💾 开始下载文件');
        XLSX.writeFile(wb, "入库记录.xlsx");
        console.log('✅ 导出完成（无弹窗）');
    } catch (err) {
        console.error('❌ 导出失败:', err);
        showMsg('导出失败：' + err.message);
    }
}

// Excel导入
async function importStockInExcel() {
    let file = document.getElementById('fileInput').files[0];
    if (!file) return;
    let reader = new FileReader();
    reader.onload = async function(e) {
        let data = new Uint8Array(e.target.result);
        let workbook = XLSX.read(data, { type: 'array' });
        let sheet = workbook.Sheets[workbook.SheetNames[0]];
        let rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        if (rows.length < 2) {
            showMsg('模板无有效数据！');
            return;
        }
        let failCount = 0, successCount = 0;
        for (let i = 1; i < rows.length; i++) {
            let row = rows[i];
            let supplier = String(row[0] || '').trim();
            let goodsName = String(row[1] || '').trim();
            let spec = String(row[2] || '').trim();
            let settleType = String(row[3] || '').trim();
            let salePrice = parseFloat(row[4]) || 0;
            let inPrice = parseFloat(row[5]) || 0;
            let inNum = parseInt(row[6]) || 0;
            let recordDate = row[7] || '';
            let produceDate = row[8] || null;
            let expireDate = row[9] || null;
            if (!supplier || !goodsName || inNum < 1 || !recordDate) { failCount++; continue; }
            if (produceDate && expireDate) { failCount++; continue; }
            if(settleType === '线下' && (inPrice === 0 || isNaN(inPrice))) { failCount++; continue; }
            if(settleType === '线上' && inPrice > 0) { failCount++; continue; }
            let targetGoods = allGoods.find(g => g.name === goodsName && g.supplier === supplier);
            let finalInPrice = 0;
            if(settleType === '线上'){
                finalInPrice = targetGoods ? Number(targetGoods.online_cost) : 0;
            }else{
                finalInPrice = inPrice;
            }
            let invoiceStatus = settleType === '线下' ? '未开票' : '';
            let postData = {
                supplier, goodsName, spec, settleType,
                sale_price: salePrice,
                in_price: finalInPrice,
                in_num: inNum,
                record_date: recordDate,
                produce_date: produceDate,
                expire_date: expireDate,
                invoice_status: invoiceStatus
            };
            try {
                await fetch(`${SUPABASE_URL}/rest/v1/stock_in`, {
                    method: 'POST',
                    headers: {
                        apikey: SUPABASE_KEY,
                        Authorization: `Bearer ${SUPABASE_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(postData)
                });
                successCount++;
            } catch (e) {
                failCount++;
            }
        }
        showMsg(`导入完成：成功${successCount}条，失败${failCount}`);
        loadStockIn();
    };
    reader.readAsArrayBuffer(file);
}

// 加载入库列表
async function loadStockIn() {
    await preLoadStockOutData();
    try {
        const fetchAll = await fetch(`${SUPABASE_URL}/rest/v1/stock_in?order=id.desc`, {
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
        });
        const allData = await fetchAll.json();
        allStockIn = allData;
        initInFilterData();
        document.getElementById('inTotalCount').textContent = allData.length;
        
        if (stockDataCache) {
            stockDataCache.clear();
        }
        refreshAllStockCache(allStockIn, allStockOut);
        
        inCurrentPage = 1;
        filterStockIn();
    } catch (e) {
        showMsg('加载入库记录失败：' + e.message);
    }
}

// 搜索筛选 - 模糊匹配
function filterStockIn() {
    const supplier = document.getElementById('inFilterSupplierInput')?.value.trim() || '';
    const goodsName = document.getElementById('inFilterGoodsNameInput')?.value.trim() || '';
    const settleType = document.getElementById('inFilterSettleTypeInput')?.value.trim() || '';

    if (!allStockIn || !Array.isArray(allStockIn)) {
        filteredStockIn = [];
    } else {
        filteredStockIn = allStockIn.filter(item => {
            let match = true;
            if (supplier && !(item.supplier || '').toLowerCase().includes(supplier.toLowerCase())) match = false;
            if (goodsName && !(item.goodsName || '').toLowerCase().includes(goodsName.toLowerCase())) match = false;
            if (settleType && !(item.settleType || '').toLowerCase().includes(settleType.toLowerCase())) match = false;
            return match;
        });
    }

    document.getElementById('inSearchCount').textContent = filteredStockIn.length;
    inCurrentPage = 1;
    renderInPagination();
    renderStockIn();
}

// 列表排序
function inSortTable(field) {
    inSortField = field;
    inSortAsc = (inSortField === field) ? !inSortAsc : true;
    filteredStockIn.sort((a,b)=>{
        let va=a[inSortField]||'', vb=b[inSortField]||'';
        if(['in_price','in_num','sale_price'].includes(inSortField)){
            va=Number(va)||0; vb=Number(vb)||0;
            return inSortAsc ? va-vb : vb-va;
        }
        return inSortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    });
    updateInSortIcon();
    renderStockIn();
}

function updateInSortIcon() {
    document.querySelectorAll('.inSortIcon').forEach(i=>i.innerText='');
    let idx = Array.from(document.querySelectorAll('.sortable')).findIndex(th=>th.onclick?.toString().includes(inSortField));
    if(idx>-1) document.querySelectorAll('.inSortIcon')[idx].innerText = inSortAsc?'↑':'↓';
}

// 渲染入库表格 - 速度优化版
async function renderStockIn() {
    let start = (inCurrentPage - 1) * inPageSize;
    let pageData = filteredStockIn.slice(start, start + inPageSize);
    let tb = document.getElementById('stockInList'); 
    if (!tb) {
        console.error('找不到入库列表DOM元素');
        return;
    }
    tb.innerHTML = '';
    
    let idUsedMap = {};
    if (pageData.length > 0) {
        const ids = pageData.map(item => item.id);
        try {
            const outRes = await fetch(`${SUPABASE_URL}/rest/v1/stock_out?inRecordId=in.(${ids.join(',')})`, {
                headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
            });
            const outList = await outRes.json() || [];
            const outIds = new Set(outList.map(item => item.inRecordId));
            
            const returnRes = await fetch(`${SUPABASE_URL}/rest/v1/return_goods?in_record_id=in.(${ids.join(',')})`, {
                headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
            });
            const returnList = await returnRes.json() || [];
            const returnIds = new Set(returnList.map(item => item.in_record_id));
            
            pageData.forEach(item => {
                idUsedMap[item.id] = outIds.has(item.id) || returnIds.has(item.id);
            });
        } catch (e) {
            console.warn('批量校验失败，降级为逐个校验', e);
            const promises = pageData.map(item => checkInUsed(item.id));
            const results = await Promise.all(promises);
            pageData.forEach((item, index) => {
                idUsedMap[item.id] = results[index];
            });
        }
    }
    
    if (!baseUnitList || baseUnitList.length === 0) {
        await loadAllBaseUnit();
    }
    if (!unitSpecList || unitSpecList.length === 0) {
        await loadAllUnitSpec();
    }
    
    const specIds = pageData.map(item => item.unit_spec_id).filter(id => id);
    let specMap = {};
    if (specIds.length > 0) {
        try {
            const specRes = await fetch(`${SUPABASE_URL}/rest/v1/unit_spec?id=in.(${specIds.join(',')})`, {
                headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
            });
            const specList = await specRes.json() || [];
            specList.forEach(spec => {
                specMap[spec.id] = spec;
            });
        } catch (e) {
            console.warn('加载规格名称失败:', e);
        }
    }
    
    const goodsMap = {};
    allGoods.forEach(g => {
        goodsMap[g.id] = g;
    });
    
    let fullHtml = '';
    
    for (let idx = 0; idx < pageData.length; idx++) {
        try {
            const item = pageData[idx];
            const cacheKey = `${item.supplier}|${item.goodsName}`;
            const cache = stockDataCache ? stockDataCache.get(cacheKey) : null;
            
            let batchRemain = 0;
            let totalStock = 0;
            let baseUnitName = '';
            
            if (item.unit_spec_id && specMap[item.unit_spec_id]) {
    const spec = specMap[item.unit_spec_id];
    const baseItem = baseUnitList.find(b => b.id == spec.base_unit_id);
    if (baseItem) {
        baseUnitName = baseItem.unit_name;
        if (cache && cache.batchList && cache.batchList.length > 0) {
            const batch = cache.batchList.find(b => {
                if (!b || !b.inRecords) return false;
                return b.inRecords.some(inItem => inItem.id === item.id);
            });
            if (batch) {
                // ✅ 修正：batch.batchRemain 已经是最小计量单位，不需要再乘以 convert_rate
                batchRemain = batch.batchRemain;
            }
        }
    }
} else {
                if (cache && cache.batchList && cache.batchList.length > 0) {
    const batchList = cache.batchList;
    batchList.forEach(batch => {
        if (!batch || !batch.inRecords) return;
        const firstRecord = batch.inRecords[0];
        if (firstRecord && firstRecord.unit_spec_id && specMap[firstRecord.unit_spec_id]) {
            const spec = specMap[firstRecord.unit_spec_id];
            const specRate = spec.convert_rate || 1;
            // ✅ 修正：batch.batchRemain 已经是最小计量单位，不需要再乘以 specRate
            totalStock += batch.batchRemain;
        } else {
            totalStock += batch.batchRemain;
        }
    });
}
            
            if (totalStock === 0 && cacheKey) {
                const allRecords = allStockIn.filter(record => 
                    record.supplier === item.supplier && 
                    record.goodsName === item.goodsName
                );
                allRecords.forEach(record => {
                    if (record.unit_spec_id && specMap[record.unit_spec_id]) {
                        const spec = specMap[record.unit_spec_id];
                        const specRate = spec.convert_rate || 1;
                        totalStock += record.in_num * specRate;
                    } else {
                        totalStock += record.in_num;
                    }
                });
            }

            let amount = formatMoney((item.in_price || 0) * item.in_num);
            let isUsed = idUsedMap[item.id] || false;
            
            let specDisplay = '-';
            if (item.unit_spec_id && specMap[item.unit_spec_id]) {
                const spec = specMap[item.unit_spec_id];
                let baseName = '';
                if (baseUnitList && baseUnitList.length > 0) {
                    const baseItem = baseUnitList.find(b => b.id == spec.base_unit_id);
                    if (baseItem) {
                        baseName = baseItem.unit_name;
                    }
                }
                specDisplay = `<div style="display:flex;flex-direction:column;align-items:center;line-height:1.4;">
                    <span style="font-weight:bold;font-size:14px;">${spec.show_name}</span>
                    <span style="font-size:12px;color:#999;">（${spec.convert_rate}${baseName}）</span>
                </div>`;
            }
            
            let batchRemainDisplay = batchRemain > 0 ? `${batchRemain}${baseUnitName}` : (item.in_num || 0);
            let totalStockDisplay = totalStock > 0 ? `${totalStock}${baseUnitName}` : (item.in_num || 0);
            
            let btnHtml = '';
            if(isUsed){
                btnHtml = `
                    <button class="btn btn-primary" disabled style="opacity:0.5">编辑</button>
                    <button class="btn btn-danger" disabled style="opacity:0.5">删除</button>
                `;
            }else{
                btnHtml = `
                    <button class="btn btn-primary" onclick="openStockInForm(${item.id})">编辑</button>
                    <button class="btn btn-danger" onclick="deleteStockIn(${item.id})">删除</button>
                `;
            }
            
            fullHtml += `
    <tr>
        <td><input type="checkbox" class="in-item-checkbox" value="${item.id}" ${isUsed ? 'disabled' : ''}></td>
        <td>${start + idx + 1}</td>
        <td>${item.supplier || ''}</td>
        <td>${item.goodsName || ''}</td>
        <td style="text-align:center;">${specDisplay}</td>
        <td>${item.settleType || ''}</td>
        <td>${formatMoney(item.in_price)}</td>
        <td>${item.in_num}</td>
        <td>${amount}</td>
        <td>${batchRemainDisplay}</td>
        <td>${totalStockDisplay}</td>
        <td>${item.produce_date || ''}</td>
        <td>${item.expire_date || ''}</td>
        <td>${item.record_date || ''}</td>
        <td>${btnHtml}</td>
    </tr>
`;
        } catch (e) {
            console.error('渲染第', idx + 1, '行时出错:', e, pageData[idx]);
            continue;
        }
    }
    tb.innerHTML = fullHtml;
}

// 分页渲染
function renderInPagination() {
    inTotalPages = Math.ceil(filteredStockIn.length / inPageSize) || 1;
    document.getElementById('inCurrentPage').textContent = inCurrentPage;
    document.getElementById('inTotalPages').textContent = inTotalPages;

    let pgBox = document.getElementById('inPageNumbers');
    pgBox.innerHTML = '';
    let s = Math.max(1, inCurrentPage - 2);
    let e = Math.min(inTotalPages, s + 4);
    for (let i = s; i <= e; i++) {
        let btn = document.createElement('button');
        btn.className = 'page-btn ' + (i === inCurrentPage ? 'active' : '');
        btn.innerText = i;
        btn.onclick = () => inGoToPage(i);
        pgBox.appendChild(btn);
    }

    let btns = document.querySelectorAll('#stockIn .page-controls .page-btn');
    if (btns.length >= 4) {
        btns[0].disabled = (inCurrentPage === 1);
        btns[1].disabled = (inCurrentPage === 1);
        btns[btns.length - 2].disabled = (inCurrentPage === inTotalPages);
        btns[btns.length - 1].disabled = (inCurrentPage === inTotalPages);
    }
}

function inGoToPage(p){ if(p<1||p>inTotalPages)return; inCurrentPage=p; renderInPagination(); renderStockIn(); }
function inPrevPage(){ inGoToPage(inCurrentPage-1); }
function inNextPage(){ inGoToPage(inCurrentPage+1); }

function changeInPageSize(){
    inPageSize = +document.getElementById('inPageSize').value;
    inCurrentPage = 1;
    renderInPagination();
    renderStockIn();
}

// 全选 - 只勾选未被禁用的checkbox
function inToggleSelectAll(){
    let all = document.getElementById('inSelectAll').checked;
    document.querySelectorAll('.in-item-checkbox').forEach(function(cb) {
        if (!cb.disabled) {
            cb.checked = all;
        }
    });
}

// 单条删除（后端校验）
async function deleteStockIn(id) {
    if (!isCurrentUserAdmin()) {
        showMsg('只有管理员可以删除入库记录');
        return;
    }

    if (await checkInUsed(id)) {
        showMsg('该入库记录已生成出库或退货单据，禁止删除！');
        return;
    }
    if (!confirm('确定删除？')) return;
    try {
        await fetch(`${SUPABASE_URL}/rest/v1/stock_in?id=eq.${id}`, {
            method: 'DELETE',
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
        });
        showMsg('删除成功');
        await loadStockIn();
    } catch (e) {
        showMsg('删除失败');
    }
}

// 批量删除（后端校验）- 跳过已被禁用的行
async function batchDeleteStockIn() {
    if (!isCurrentUserAdmin()) {
        showMsg('只有管理员可以批量删除入库记录');
        return;
    }

    let ids = [];
    let hasDisabled = false;
    
    document.querySelectorAll('.in-item-checkbox').forEach(function(cb) {
        if (cb.checked) {
            if (cb.disabled) {
                hasDisabled = true;
            } else {
                ids.push(cb.value);
            }
        }
    });
    
    if (ids.length === 0) {
        if (hasDisabled) {
            showMsg('选中的记录中存在已生成出库或退货单据的数据，无法删除！');
        } else {
            showMsg('请选择数据');
        }
        return;
    }
    
    let usedIds = [];
    for (let id of ids) {
        if (await checkInUsed(id)) {
            usedIds.push(id);
        }
    }

    if (usedIds.length > 0) {
        showMsg(`选中数据中有 ${usedIds.length} 条已关联出库或退货单据，无法删除！`);
        return;
    }
    
    if (!confirm(`确定删除${ids.length}条？`)) return;
    for (let id of ids) {
        await fetch(`${SUPABASE_URL}/rest/v1/stock_in?id=eq.${id}`, {
            method: 'DELETE',
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
        });
    }
    showMsg('批量删除成功');
    await loadStockIn();
}

// 清空排序、重置搜索
function clearInSort(){
    inSortField = ''; inSortAsc = true; updateInSortIcon(); loadStockIn();
}

// ===== 全局点击关闭下拉列表（入库模块） =====
(function() {
    if (window._stockInClickOutsideBound) return;
    window._stockInClickOutsideBound = true;
    document.addEventListener('click', function(e) {
        const supInput = document.getElementById('supSearchInput');
        const supList = document.getElementById('supListBox');
        if (supList && supList.style.display === 'block') {
            if (supInput && !supInput.contains(e.target) && !supList.contains(e.target)) {
                supList.style.display = 'none';
            }
        }
        const goodsInput = document.getElementById('goodsSearchInput');
        const goodsList = document.getElementById('goodsListBox');
        if (goodsList && goodsList.style.display === 'block') {
            if (goodsInput && !goodsInput.contains(e.target) && !goodsList.contains(e.target)) {
                goodsList.style.display = 'none';
            }
        }
    });
})();

// ===== 全局点击关闭下拉列表（入库筛选） =====
document.addEventListener('click', function(e) {
    const listIds = [
        'inFilterSupplierList',
        'inFilterGoodsNameList',
        'inFilterSettleTypeList'
    ];
    listIds.forEach(id => {
        const box = document.getElementById(id);
        if (box && !e.target.closest(`#${id}`) && !e.target.closest(`#${id.replace('List', 'Input')}`)) {
            box.style.display = 'none';
        }
    });
});
// ============================================================
// ✅ 暴露入库模块所有函数到 window 对象（供 HTML onclick 调用）
// ============================================================
(function exposeInFunctions() {
    console.log('🔄 开始暴露出入库函数到全局...');
    
    const functions = {
        openStockInForm: openStockInForm,
        closeStockInForm: closeStockInForm,
        submitStockIn: submitStockIn,
        refreshStockIn: refreshStockIn,
        loadStockIn: loadStockIn,
        filterStockIn: filterStockIn,
        inSortTable: inSortTable,
        inGoToPage: inGoToPage,
        inPrevPage: inPrevPage,
        inNextPage: inNextPage,
        changeInPageSize: changeInPageSize,
        inToggleSelectAll: inToggleSelectAll,
        deleteStockIn: deleteStockIn,
        batchDeleteStockIn: batchDeleteStockIn,
        clearInSort: clearInSort,
        resetInSearch: resetInSearch,
        showInFilterList: showInFilterList,
        filterInFilterList: filterInFilterList,
        onInFilterInput: onInFilterInput,
        showSupList: showSupList,
        filterSupplierList: filterSupplierList,
        showGoodsList: showGoodsList,
        filterGoodsList: filterGoodsList,
        selectInGoods: selectInGoods,
        onInUnitSpecChange: onInUnitSpecChange,
        lockExpireDate: lockExpireDate,
        lockProduceDate: lockProduceDate,
        updateInPriceByDate: updateInPriceByDate,
        downloadStockInTemplate: downloadStockInTemplate,
        exportStockInExcel: exportStockInExcel,
        importStockInExcel: importStockInExcel,
        updateStockFields: updateStockFields,
        updatePriceTempState: updatePriceTempState
    };
    
    for (const [key, fn] of Object.entries(functions)) {
        if (typeof fn === 'function') {
            window[key] = fn;
        } else {
            console.warn(`⚠️ ${key} 不是函数，跳过`);
        }
    }
    
    console.log('✅ openStockInForm 类型:', typeof window.openStockInForm);
    console.log('✅ 入库模块所有函数已暴露到全局');
})();