var d = $json;
var biz = d.businesses;
var token = d.response_token;
var firstName = d.customer_name.split(' ')[0];
var amount = parseFloat(d.amount || 0);
var jobTitle = d.job_title || 'your job';

// Get breakdown — try webhook body first, then ai_estimate_notes
var breakdown = {};
try {
  var webhookBody = $('Webhook').item.json.body || {};
  if (webhookBody.breakdown && typeof webhookBody.breakdown === 'object') {
    breakdown = webhookBody.breakdown;
  } else if (d.ai_estimate_notes) {
    breakdown = JSON.parse(d.ai_estimate_notes);
  }
} catch(e) { breakdown = {}; }

var showBreakdown = breakdown.showBreakdown !== undefined
  ? breakdown.showBreakdown
  : (biz.default_show_breakdown !== false);
var showBizDetails = breakdown.showBusinessDetails !== undefined
  ? breakdown.showBusinessDetails
  : !!(biz.address || biz.gst_number || biz.license_number);
var gstInclusive = breakdown.gstInclusive !== undefined ? breakdown.gstInclusive : (biz.gst_inclusive !== false);
var hasGST = !!biz.gst_number;
var showGST = breakdown.showGST !== undefined ? breakdown.showGST : hasGST;
var dateStr = new Date().toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' });

// GST calculations
var subtotal = 0;
var gstAmount = 0;
var totalInclGST = amount;
if (hasGST) {
  if (gstInclusive) {
    subtotal = Math.round((amount / 1.15) * 100) / 100;
    gstAmount = Math.round((amount - subtotal) * 100) / 100;
    totalInclGST = amount;
  } else {
    subtotal = amount;
    gstAmount = Math.round(amount * 0.15 * 100) / 100;
    totalInclGST = Math.round((amount + gstAmount) * 100) / 100;
  }
}

// Format currency helper
function fmtNZD(val) {
  return '$' + parseFloat(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Get scope — from breakdown OR from description field (split before "Materials:")
var fullDesc = d.description || '';
var scope = breakdown.scope || '';
var materialsText = breakdown.materials || '';
var notes = breakdown.notes || '';
var qFooter = breakdown.quoteFooter || biz.quote_footer || '';

// If no breakdown data, parse the description field
if (!scope && fullDesc) {
  var matIdx = fullDesc.indexOf('\n\nMaterials:\n');
  var notesIdx = fullDesc.indexOf('\n\nNotes:\n');
  if (matIdx > -1) {
    scope = fullDesc.substring(0, matIdx);
    if (notesIdx > -1) {
      materialsText = fullDesc.substring(matIdx + 13, notesIdx);
      notes = notes || fullDesc.substring(notesIdx + 9);
    } else {
      materialsText = fullDesc.substring(matIdx + 13);
    }
  } else if (notesIdx > -1) {
    scope = fullDesc.substring(0, notesIdx);
    notes = notes || fullDesc.substring(notesIdx + 9);
  } else {
    scope = fullDesc;
  }
}

var h = '<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">';

h += '<div style="padding:32px 40px;">';

// Business name + Quote/Date
h += '<table style="width:100%;border-collapse:collapse;margin-bottom:32px;" cellpadding="0" cellspacing="0"><tr>';
h += '<td style="vertical-align:top;">';
h += '<div style="font-size:28px;font-weight:800;color:#0A0E17;">' + biz.business_name + '</div>';
if (showBizDetails && biz.address) h += '<div style="font-size:13px;color:#6b7280;margin-top:4px;">' + biz.address + '</div>';
if (biz.phone) h += '<div style="font-size:13px;color:#6b7280;margin-top:' + (showBizDetails && biz.address ? '0' : '4px') + ';">' + biz.phone + '</div>';
if (biz.email) h += '<div style="font-size:13px;color:#6b7280;">' + biz.email + '</div>';
if (showBizDetails) {
  var dets = [];
  if (biz.gst_number) dets.push('GST: ' + biz.gst_number);
  if (biz.license_number) dets.push(biz.license_number);
  if (dets.length) h += '<div style="font-size:11px;color:#9ca3af;margin-top:4px;">' + dets.join(' &middot; ') + '</div>';
}
h += '</td>';
h += '<td style="vertical-align:top;text-align:right;">';
h += '<div style="font-size:11px;color:#9ca3af;text-transform:uppercase;font-weight:600;letter-spacing:1px;">Quote</div>';
h += '<div style="font-size:13px;color:#6b7280;margin-top:4px;">' + dateStr + '</div>';
h += '</td></tr></table>';

// Teal divider
h += '<div style="border-bottom:3px solid #14B8A6;margin-bottom:24px;"></div>';

// Prepared For
h += '<div style="margin-bottom:24px;">';
h += '<div style="font-size:12px;color:#9ca3af;text-transform:uppercase;font-weight:600;letter-spacing:1px;margin-bottom:6px;">Prepared For</div>';
h += '<div style="font-size:16px;font-weight:600;color:#111827;">' + d.customer_name + '</div>';
if (d.customer_email) h += '<div style="font-size:13px;color:#6b7280;">' + d.customer_email + '</div>';
if (d.customer_phone) h += '<div style="font-size:13px;color:#6b7280;">' + d.customer_phone + '</div>';
h += '</div>';

// Job
h += '<div style="margin-bottom:24px;">';
h += '<div style="font-size:12px;color:#9ca3af;text-transform:uppercase;font-weight:600;letter-spacing:1px;margin-bottom:6px;">Job</div>';
h += '<div style="font-size:18px;font-weight:700;color:#111827;">' + jobTitle + '</div>';
h += '</div>';

// Scope of Work
if (scope) {
  h += '<div style="margin-bottom:24px;">';
  h += '<div style="font-size:12px;color:#9ca3af;text-transform:uppercase;font-weight:600;letter-spacing:1px;margin-bottom:6px;">Scope of Work</div>';
  h += '<div style="font-size:14px;color:#374151;line-height:1.7;white-space:pre-line;">' + scope + '</div>';
  h += '</div>';
}

// Materials list (only if showBreakdown)
if (showBreakdown && materialsText) {
  h += '<div style="margin-bottom:24px;">';
  h += '<div style="font-size:12px;color:#9ca3af;text-transform:uppercase;font-weight:600;letter-spacing:1px;margin-bottom:6px;">Materials</div>';
  h += '<div style="font-size:14px;color:#374151;line-height:1.8;white-space:pre-line;">' + materialsText + '</div>';
  h += '</div>';
}

// Pricing box
h += '<div style="background:#f9fafb;border-radius:10px;padding:20px;margin-bottom:24px;">';

if (showBreakdown) {
  var lineItems = breakdown.lineItems || [];
  var filledItems = lineItems.filter(function(i) { return i && i.description && i.description.trim(); });

  if (filledItems.length > 0) {
    h += '<table style="width:100%;border-collapse:collapse;margin-bottom:8px;" cellpadding="0" cellspacing="0">';
    for (var i = 0; i < filledItems.length; i++) {
      var price = parseFloat(filledItems[i].price) ? '$' + parseFloat(filledItems[i].price).toFixed(2) : '';
      var bb = i < filledItems.length - 1 ? 'border-bottom:1px solid #e5e7eb;' : '';
      h += '<tr><td style="font-size:14px;color:#374151;padding:6px 0;' + bb + '">' + filledItems[i].description + '</td>';
      h += '<td style="font-size:14px;color:#111827;font-weight:500;text-align:right;padding:6px 0;white-space:nowrap;' + bb + '">' + price + '</td></tr>';
    }
    h += '</table>';
  }

  if (parseFloat(breakdown.materialsCost) > 0) {
    h += '<table style="width:100%;border-collapse:collapse;" cellpadding="0" cellspacing="0">';
    h += '<tr><td style="font-size:14px;color:#6b7280;padding:4px 0;">Materials</td>';
    h += '<td style="font-size:14px;color:#111827;font-weight:500;text-align:right;padding:4px 0;white-space:nowrap;">$' + parseFloat(breakdown.materialsCost).toLocaleString() + '</td></tr></table>';
  }

  if (breakdown.labourHours && biz.hourly_rate) {
    var labourTotal = parseFloat(breakdown.labourHours) * parseFloat(biz.hourly_rate);
    h += '<table style="width:100%;border-collapse:collapse;" cellpadding="0" cellspacing="0">';
    h += '<tr><td style="font-size:14px;color:#6b7280;padding:4px 0;">Labour (' + breakdown.labourHours + ' hrs @ $' + biz.hourly_rate + '/hr)</td>';
    h += '<td style="font-size:14px;color:#111827;font-weight:500;text-align:right;padding:4px 0;white-space:nowrap;">$' + labourTotal.toLocaleString() + '</td></tr></table>';
  }

  if (breakdown.includeCallout && parseFloat(biz.callout_fee) > 0) {
    h += '<table style="width:100%;border-collapse:collapse;" cellpadding="0" cellspacing="0">';
    h += '<tr><td style="font-size:14px;color:#6b7280;padding:4px 0;">Callout Fee</td>';
    h += '<td style="font-size:14px;color:#111827;font-weight:500;text-align:right;padding:4px 0;white-space:nowrap;">$' + parseFloat(biz.callout_fee).toLocaleString() + '</td></tr></table>';
  }
}

// GST breakdown + Total
if (showGST && hasGST) {
  h += '<table style="width:100%;border-collapse:collapse;border-top:' + (showBreakdown ? '2px solid #111827' : 'none') + ';margin-top:' + (showBreakdown ? '8px' : '0') + ';" cellpadding="0" cellspacing="0">';
  h += '<tr><td style="font-size:14px;color:#6b7280;padding:' + (showBreakdown ? '12px' : '0') + ' 0 4px 0;">Subtotal (excl. GST)</td>';
  h += '<td style="font-size:14px;color:#111827;font-weight:500;text-align:right;padding:' + (showBreakdown ? '12px' : '0') + ' 0 4px 0;white-space:nowrap;">' + fmtNZD(subtotal) + '</td></tr>';
  h += '<tr><td style="font-size:14px;color:#6b7280;padding:4px 0;">GST (15%)</td>';
  h += '<td style="font-size:14px;color:#111827;font-weight:500;text-align:right;padding:4px 0;white-space:nowrap;">' + fmtNZD(gstAmount) + '</td></tr>';
  h += '<tr><td style="font-size:18px;font-weight:700;color:#111827;padding-top:10px;border-top:2px solid #111827;">Total (incl. GST)</td>';
  h += '<td style="font-size:24px;font-weight:800;color:#14B8A6;text-align:right;padding-top:10px;border-top:2px solid #111827;white-space:nowrap;">' + fmtNZD(totalInclGST) + '</td></tr></table>';
} else {
  h += '<table style="width:100%;border-collapse:collapse;border-top:' + (showBreakdown ? '2px solid #111827' : 'none') + ';margin-top:' + (showBreakdown ? '8px' : '0') + ';" cellpadding="0" cellspacing="0">';
  h += '<tr><td style="font-size:18px;font-weight:700;color:#111827;padding-top:' + (showBreakdown ? '12px' : '0') + ';">Total</td>';
  h += '<td style="font-size:24px;font-weight:800;color:#14B8A6;text-align:right;padding-top:' + (showBreakdown ? '12px' : '0') + ';white-space:nowrap;">' + fmtNZD(amount) + '</td></tr></table>';
}

h += '</div>';

// Terms & Conditions
if (notes) {
  h += '<div style="margin-bottom:24px;">';
  h += '<div style="font-size:12px;color:#9ca3af;text-transform:uppercase;font-weight:600;letter-spacing:1px;margin-bottom:6px;">Terms & Conditions</div>';
  h += '<div style="font-size:13px;color:#6b7280;line-height:1.6;white-space:pre-line;">' + notes + '</div>';
  h += '</div>';
}

// Quote footer
if (showBizDetails && qFooter) {
  h += '<div style="margin-bottom:24px;padding:14px 16px;border-radius:8px;background:#f9fafb;border:1px solid #e5e7eb;">';
  h += '<div style="font-size:13px;color:#6b7280;line-height:1.6;white-space:pre-line;">' + qFooter + '</div>';
  h += '</div>';
}

// Deposit & bank details
if (biz.require_deposit && biz.bank_account_number) {
  var depPct = biz.deposit_percentage || 25;
  var depAmt = totalInclGST * (parseFloat(depPct) / 100);
  h += '<div style="margin-bottom:24px;padding:16px 20px;border-radius:10px;background:#f0fdfa;border:1px solid #ccfbf1;">';
  h += '<div style="font-size:12px;font-weight:700;color:#0d9488;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">Deposit Required &mdash; ' + depPct + '%</div>';
  h += '<table style="width:100%;border-collapse:collapse;" cellpadding="0" cellspacing="0">';
  h += '<tr><td style="font-size:14px;color:#0d9488;font-weight:600;padding:3px 0;">Deposit Amount</td>';
  h += '<td style="font-size:16px;font-weight:700;color:#0d9488;text-align:right;padding:3px 0;white-space:nowrap;">' + fmtNZD(depAmt) + '</td></tr></table>';
  h += '<div style="border-top:1px solid #ccfbf1;padding-top:10px;margin-top:10px;">';
  h += '<div style="font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Payment Details</div>';
  h += '<table style="width:100%;border-collapse:collapse;" cellpadding="0" cellspacing="0">';
  if (biz.bank_name) h += '<tr><td style="font-size:13px;color:#6b7280;padding:2px 0;">Bank</td><td style="font-size:13px;color:#111827;text-align:right;padding:2px 0;">' + biz.bank_name + '</td></tr>';
  if (biz.bank_account_name) h += '<tr><td style="font-size:13px;color:#6b7280;padding:2px 0;">Account Name</td><td style="font-size:13px;color:#111827;text-align:right;padding:2px 0;">' + biz.bank_account_name + '</td></tr>';
  h += '<tr><td style="font-size:13px;color:#6b7280;padding:2px 0;">Account Number</td><td style="font-size:13px;color:#111827;font-weight:600;text-align:right;padding:2px 0;">' + biz.bank_account_number + '</td></tr>';
  h += '</table></div></div>';
}

// Powered by + Valid for 30 days
h += '<table style="width:100%;border-collapse:collapse;border-top:1px solid #e5e7eb;" cellpadding="0" cellspacing="0">';
h += '<tr><td style="font-size:11px;color:#9ca3af;padding-top:16px;">Powered by <span style="color:#14B8A6;font-weight:600;">Wynflow</span></td>';
h += '<td style="font-size:11px;color:#9ca3af;text-align:right;padding-top:16px;">Valid for 30 days</td></tr></table>';

h += '</div>';

// Action buttons
h += '<div style="padding:20px 40px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;">';
h += '<table style="width:100%;" cellpadding="0" cellspacing="0">';
h += '<tr><td style="text-align:center;padding-bottom:12px;">';
h += '<a href="https://wynfallautomation.app.n8n.cloud/webhook/quote-response?token=' + token + '&action=book_in" style="display:inline-block;background:#22C55E;color:#ffffff;padding:14px 40px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">Accept Quote</a>';
h += '</td></tr>';
h += '<tr><td style="text-align:center;">';
h += '<a href="https://wynfallautomation.app.n8n.cloud/webhook/quote-response?token=' + token + '&action=decline" style="color:#9ca3af;font-size:13px;text-decoration:underline;">No thanks</a>';
h += '</td></tr></table>';
h += '</div>';

h += '</div>';

return [{
  json: {
    from: "Wynflow <quotes@wynflow.co.nz>",
    to: d.customer_email,
    reply_to: biz.email,
    subject: "Your quote from " + biz.business_name + " — " + jobTitle,
    html: h
  }
}];
