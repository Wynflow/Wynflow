-- Add CCA Form 1 toggle to businesses table.
-- When true, invoices generated as PDF will append the prescribed
-- "Information that must accompany all payment claims" form (Form 1)
-- under Section 20 of the Construction Contracts Act 2002.
-- Required for all payment claims to residential occupiers.
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS include_cca_form1 boolean DEFAULT false;
