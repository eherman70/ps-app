const API = 'http://localhost:3001/api';

async function request(path, options = {}, token = null) {
  const res = await fetch(`${API}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    throw new Error(`${path} -> ${res.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
  }

  return data;
}

(async () => {
  try {
    const login = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    });

    const token = login.token;
    if (!token) throw new Error('No auth token returned from login');

    await request('/exchange-rate', {
      method: 'POST',
      body: JSON.stringify({ rate: 3000, locked: true }),
    }, token);

    const [farmers, tickets, issuedInputs, currentRates] = await Promise.all([
      request('/farmers', {}, token),
      request('/tickets', {}, token),
      request('/issued-inputs', {}, token),
      request('/deduction-rates', {}, token),
    ]);

    if (!farmers.length) throw new Error('No farmers found for test');

    const totalsByFarmer = farmers.map((f) => {
      const farmerTickets = tickets.filter((t) => t.farmerId === f.id);
      const farmerInputs = issuedInputs.filter((i) => i.farmerId === f.id);
      const totalSales = farmerTickets.reduce((sum, t) => sum + parseFloat(t.value || t.totalValue || 0), 0);
      const totalInputs = farmerInputs.reduce((sum, i) => sum + parseFloat(i.totalCost || i.totalValue || 0), 0);
      const usdBalance = totalSales - totalInputs;
      return { farmer: f, totalSales, totalInputs, usdBalance };
    });

    totalsByFarmer.sort((a, b) => b.usdBalance - a.usdBalance);
    const selected = totalsByFarmer.find((x) => x.usdBalance > 0) || totalsByFarmer[0];
    const farmer = selected.farmer;
    const psCode = farmer.ps || 'All';

    const levyRate = 5.5;
    const adminFeeRate = 1.75;

    const nextRates = {
      default: {
        levyRate: Number(currentRates?.default?.levyRate ?? 2),
        adminFeeRate: Number(currentRates?.default?.adminFeeRate ?? 1),
      },
      byPs: {
        ...(currentRates?.byPs || {}),
        [psCode]: { levyRate, adminFeeRate },
      },
    };

    const savedRates = await request('/deduction-rates', {
      method: 'POST',
      body: JSON.stringify(nextRates),
    }, token);

    const effective = savedRates?.byPs?.[psCode] || savedRates?.default || { levyRate: 2, adminFeeRate: 1 };
    const rate = 3000;
    const tzsGross = selected.usdBalance * rate;
    const expectedLevy = tzsGross * ((parseFloat(effective.levyRate) || 0) / 100);
    const expectedAdminFee = tzsGross * ((parseFloat(effective.adminFeeRate) || 0) / 100);
    const totalDeductions = expectedLevy + expectedAdminFee;
    const tzsNet = tzsGross - totalDeductions;

    const payment = await request('/payments', {
      method: 'POST',
      body: JSON.stringify({
        farmerId: farmer.id,
        pcnId: null,
        tobaccoAmount: selected.totalSales,
        inputDeduction: selected.totalInputs,
        usdBalance: selected.usdBalance,
        exchangeRate: rate,
        tzsGross,
        levy: expectedLevy,
        adminFee: expectedAdminFee,
        totalDeductions,
        netPayment: tzsNet,
        paymentDate: new Date().toISOString().slice(0, 10),
        ps: farmer.ps,
      }),
    }, token);

    const payments = await request('/payments', {}, token);
    const saved = payments.find((p) => p.id === payment.id);
    if (!saved) throw new Error('Saved payment not found in /payments response');

    const round2 = (n) => Number(parseFloat(n || 0).toFixed(2));

    const result = {
      farmer: {
        id: farmer.id,
        farmerNumber: farmer.farmerNumber,
        name: `${farmer.firstName} ${farmer.lastName}`,
        ps: psCode,
      },
      configuredRates: {
        levyRate: effective.levyRate,
        adminFeeRate: effective.adminFeeRate,
      },
      paymentId: payment.id,
      computed: {
        usdBalance: round2(selected.usdBalance),
        tzsGross: round2(tzsGross),
        expectedLevy: round2(expectedLevy),
        expectedAdminFee: round2(expectedAdminFee),
        expectedNet: round2(tzsNet),
      },
      savedInDbViaApi: {
        levy: round2(saved.levy),
        adminFee: round2(saved.adminFee),
        netPayment: round2(saved.netPayment),
      },
      matches: {
        levy: round2(saved.levy) === round2(expectedLevy),
        adminFee: round2(saved.adminFee) === round2(expectedAdminFee),
      },
    };

    console.log('E2E_PAYMENT_DEDUCTION_TEST_OK');
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('E2E_PAYMENT_DEDUCTION_TEST_ERR');
    console.error(err.message || err);
    process.exit(1);
  }
})();
