import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import SurveyTemplate from "@/lib/models/SurveyTemplate";

const DEFAULT_TEMPLATE = {
  templateId: "qfs-manufacturing-survey",
  name: "Quality and Food Safety Manufacturing Supplier Survey",
  docNo: "00-FRM-01.0070",
  revNo: "5.1",
  status: "active",
  description: "Comprehensive survey covering GFSI accreditation, regulatory compliance, declarations, organic supply, authorization, and item-specific document checklists for manufacturing suppliers.",
  pages: [
    {
      title: "Company Information",
      icon: "Building2",
      sections: [
        {
          title: "Company Information",
          subtitle: "Doc. No.: 00-FRM-01.0070 | Rev. No.: 5.1",
          fields: [
            { key: "companyName", label: "Company Name", type: "text", required: true, gridCols: 1 },
            { key: "supplierId", label: "Supplier ID", type: "text", disabled: true, gridCols: 1 },
            { key: "address", label: "Manufacturing Site Address", type: "text", gridCols: 1 },
            { key: "cityStateZip", label: "City, State, ZIP", type: "text", gridCols: 1 },
            { key: "phone", label: "Phone", type: "text", gridCols: 1 },
            { key: "country", label: "Country", type: "text", gridCols: 1 },
            { key: "contactName", label: "Contact Name", type: "text", gridCols: 1 },
            { key: "email", label: "Email", type: "text", gridCols: 1 },
            { key: "surveyDate", label: "Date", type: "date", gridCols: 1 },
          ],
        },
      ],
    },
    {
      title: "General Compliance (Q1–Q6)",
      icon: "ClipboardCheck",
      sections: [
        {
          title: "General Compliance Questions",
          fields: [
            { key: "q1_womanMinority", label: "1. Are you a woman or minority owned business?", type: "radio", options: ["Yes", "No"] },
            { key: "q2_gfsi", label: "2. Has your company achieved GFSI Accreditation? (BRC, SQF, FSSC 22000, etc.) or Equivalent Food Safety Inspection? (Must be current)", type: "radio", options: ["Yes", "No"] },
            { key: "q2_auditName", label: "Audit Contact Name", type: "text", placeholder: "Name", helpText: "If Third Party Full Audit Report is not available, provide contact info for onsite audit" },
            { key: "q2_auditPhone", label: "Audit Contact Phone", type: "text", placeholder: "Phone #" },
            { key: "q2_auditEmail", label: "Audit Contact Email", type: "text", placeholder: "Email" },
            { key: "q3_regulatory", label: "3. Are you fully compliant with FDA, FSMA, USDA, or other Country of Origin regulatory requirements?", type: "radio", options: ["Yes", "No"] },
            { key: "q3_compliance", label: "Compliance Certifications", type: "checklist", options: ["FDA", "FSMA", "USDA"] },
            { key: "q4_countryOrigin", label: "4. Country of Origin where regulatory compliant:", type: "text", placeholder: "Enter country..." },
            { key: "q4_explain", label: "If No, please explain:", type: "textarea" },
            { key: "q5_lotCoding", label: "5. Do you have lot coding for traceability?", type: "radio", options: ["Yes", "No"] },
            { key: "q5_mockRecallDate", label: "Date of last mock recall", type: "date" },
            { key: "q5_percentRecovered", label: "Percent recovered", type: "text" },
            { key: "q5_time", label: "Time", type: "text" },
            { key: "q6_pesticides", label: "6. Do you have a way that assures pesticides and heavy metals are in conformance with U.S or other receiving country's governing regulations?", type: "radio", options: ["Yes", "No"] },
            { key: "q6_explain", label: "If No, please explain:", type: "textarea" },
          ],
        },
      ],
    },
    {
      title: "Declarations & Organic Supply",
      icon: "Shield",
      sections: [
        {
          title: "Declarations",
          fields: [
            { key: "decl1_bioterrorism", label: "Public Health Security and Bioterrorism Preparedness and Response Act of 2002 — Is your facility compliant?", type: "radio", options: ["Yes", "No", "N/A"] },
            { key: "decl1_explain", label: "If No or N/A, please explain:", type: "textarea" },
            { key: "decl2_trafficking", label: "Human Trafficking — Has your facility failed any ethical audit or been found noncompliant to laws governing human trafficking and slavery?", type: "radio", options: ["Yes", "No"], helpText: "VIDA BUDDIES INC. expects suppliers to comply with all applicable state, government, and international laws." },
            { key: "decl2_explain", label: "If Yes, please explain:", type: "textarea" },
          ],
        },
        {
          title: "Organic Supply",
          fields: [
            { key: "organic_supply", label: "Are you selling an organic supply?", type: "radio", options: ["Yes", "No", "N/A"], helpText: "If Yes, please include your Organic Certificate and Organic Certification Summary." },
          ],
        },
        {
          title: "Organic Plastic Bins",
          fields: [
            { key: "organic_bins", label: "Are you providing organic raw fruit in unlined plastic bins that are not permanently stenciled \"Organic\"?", type: "radio", options: ["Yes", "No"], helpText: "If yes, Organic Wash Procedure must be submitted." },
            { key: "organic_bins_comment", label: "Comment:", type: "textarea" },
          ],
        },
      ],
    },
    {
      title: "Authorization & Document Checklists",
      icon: "FileText",
      sections: [
        {
          title: "Authorization",
          subtitle: "Your typed name is your electronic signature",
          highlight: true,
          fields: [
            { key: "auth_name", label: "Name (Print)", type: "text", required: true, gridCols: 1 },
            { key: "auth_title", label: "Title", type: "text", required: true, gridCols: 1 },
            { key: "auth_date", label: "Date", type: "date", required: true, gridCols: 1 },
          ],
        },
        {
          title: "Parent Company Documents",
          subtitle: "*Certificate of Liability Insurance, if not provided by Broker",
          fields: [
            { key: "parent_docs", label: "Required Documents", type: "checklist", options: [
              "*Certificate of Liability Insurance, if not provided by Broker",
              "Letter of Guarantee, if not provided by Broker or Manufacturing Facility",
              "USDA Compliant Organic Certificate with item(s) listed, if applicable",
            ] },
          ],
        },
        {
          title: "Manufacturing Facility Documents",
          subtitle: "In addition to each item specific documents",
          fields: [
            { key: "mfg_docs", label: "Required Documents", type: "checklist", options: [
              "Manufacturing Supplier Survey",
              "Kosher Certificate with item(s) listed, if applicable",
              "USDA Compliant Organic Certificate with item(s) listed, if applicable",
              "Halal Certificate with item(s) listed, if applicable",
              "Allergen Statement",
              "Allergen Control Program if allergens are present in manufacturing facility",
              "Allergen Cleaning Program, if allergens are ran on the same line or present in the manufacturing facility",
              "Allergen Sanitation Validation Study, if allergens are ran on the same line",
              "Prop 65 Statement",
              "Third Party Food Safety Audit Certificate (GFSI accredited or equivalent)",
              "Third Party Full Food Safety Audit Report (GFSI accredited or equivalent)",
              "*Certificate of Liability Insurance",
              "Letter of Guarantee, if not provided by Parent Company and Broker",
              "HACCP/HARPC Documents (Process Flow Diagrams and CCP/Preventative Controls/Summary Sheet)",
            ] },
          ],
        },
      ],
    },
    {
      title: "Raw Fruit & Ingredient Documents",
      icon: "Leaf",
      sections: [
        {
          title: "Packing House Raw Fruit Supplier Documents",
          subtitle: "Only applies to Raw Fruit",
          description: "Raw Agricultural Commodity is defined by 21 USCS § 321 as any food in its raw or natural state.",
          fields: [
            { key: "rawfruit_docs", label: "Required Documents", type: "checklist", options: [
              "Manufacturing Supplier Survey",
              "*Certificate of Liability Insurance, if not provided by Broker or Parent Company",
              "USDA Organic compliant Certificate with item(s) listed, if applicable",
              "QAI Compliance Affidavit for Export of NOP Organic Product to Canada (AESOP 10478) if applicable",
              "Third Party Food Safety Audit Certificate (GFSI accredited or equivalent)",
              "Third Party Food Safety Audit Report (GFSI accredited or equivalent)",
            ] },
          ],
        },
        {
          title: "Ingredient Items",
          fields: [
            { key: "ingredient_docs", label: "Required Documents", type: "checklist", options: [
              "Supply Survey for each item supplied to VIDA BUDDIES INC",
              "Allergen Statement",
              "GMO Statement",
              "Label",
              "Nutritional Statement",
              "Pesticide Monitoring Program and/or test results",
              "Heavy Metals Monitoring Program and/or test results",
              "Product Data Sheet",
              "Country of Origin",
              "Safety Data Sheet (SDS), if applicable",
              "QAI Non-Organic Material Affidavit (NOMA #9331)",
              "Bone Char Statement ONLY APPLIES to SUGAR",
              "Concord Grape-Kosher, OU certified ONLY",
              "RSPO (Roundtable on Sustainable Palm Oil) Certificate, if applicable",
              "QAI Organic Input and Ingredient Commercial Availability Information (AESOP #9593) if applicable",
              "Bioengineered Food/Ingredient Disclosure Supplier Form, if applicable",
            ] },
          ],
        },
        {
          title: "Flavor Ingredient Items",
          fields: [
            { key: "flavor_docs", label: "Required Documents", type: "checklist", options: [
              "Supply Survey for each item supplied to VIDA BUDDIES INC",
              "Allergen Statement",
              "GMO Statement",
              "Label",
              "Nutritional Statement with ingredient statement",
              "FEMA/GRAS Statement",
              "Product Data Sheet",
              "Country of Origin",
              "Safety Data Sheet (SDS)",
              "Prop 65 Statement",
              "Natural Flavor Statement",
              "For Non-organic natural flavors – (QAI #9603) Natural Flavor Questionnaire-NOP, if applicable",
              "Bioengineered Food/Ingredient Disclosure Supplier Form, if applicable",
            ] },
          ],
        },
      ],
    },
    {
      title: "Packaging & Chemical Documents",
      icon: "Package",
      sections: [
        {
          title: "Primary Packaging Items",
          subtitle: "Food Contact Packaging",
          fields: [
            { key: "primary_pkg_docs", label: "Required Documents", type: "checklist", options: [
              "Supply Survey for each item supplied to VIDA BUDDIES INC",
              "Specification Sheet, with drawing for each item supplied to VIDA BUDDIES INC",
              "Allergen Statement",
              "Bisphenol A (BPA) Statement",
              "Phthalate Statement",
              "Food Grade Statement",
              "Migration Statement",
              "Declaration of continued guarantee of compliance (compliance to 21 CFR 170-199)",
            ] },
          ],
        },
        {
          title: "Secondary Packaging Items",
          subtitle: "Non-Food Contact Packaging",
          fields: [
            { key: "secondary_pkg_docs", label: "Required Documents", type: "checklist", options: [
              "Company Information (Company Name, Address, Contact info, etc.)",
              "Specification Sheet with drawing for each item supplied to VIDA BUDDIES INC",
              "Shelf life Information",
              "*Certificate of Liability Insurance",
            ] },
          ],
        },
        {
          title: "Food Contact Chemicals",
          fields: [
            { key: "food_chem_docs", label: "Required Documents", type: "checklist", options: [
              "Supply Survey for each item supplied to VIDA BUDDIES INC",
              "Chemical label with \"Direction for Use\"",
              "Allergen Statement",
              "Safety Data Sheet (SDS)",
              "Chemical Specification including Country of Origin",
              "Food Grade Statement",
              "*Certificate of Liability Insurance",
            ] },
          ],
        },
        {
          title: "Non-Food Contact Chemicals",
          fields: [
            { key: "nonfood_chem_docs", label: "Required Documents", type: "checklist", options: [
              "Company Information (Company Name, Address, Contact Info, etc.)",
              "Chemical Specification",
              "Chemical label",
              "Shelf life Information",
              "Safety Data Sheet (SDS)",
              "*Certificate of Liability Insurance",
            ] },
          ],
        },
      ],
    },
  ],
};

const SUPPLY_SURVEY_TEMPLATE = {
  templateId: "qfs-supply-survey",
  name: "Quality and Food Safety Supply Survey",
  docNo: "00-FRM-01.068",
  revNo: "4.2",
  status: "active",
  description: "Item-level supply survey covering product compliance, ingredient statements, allergens, and supplier declarations for each item supplied to VIDA BUDDIES INC.",
  pages: [
    {
      title: "Company & Item Info",
      icon: "Building2",
      sections: [
        {
          title: "Company & Item Information",
          subtitle: "Doc. No.: 00-FRM-01.068 | Rev. No.: 4.2",
          description: "Please complete the Supply Survey for each item supplied to VIDA BUDDIES INC. in its entirety and attach all requested supporting documents.",
          fields: [
            { key: "ss_date", label: "Date", type: "date", gridCols: 1 },
            { key: "ss_companyName", label: "Company Name", type: "text", required: true, gridCols: 1 },
            { key: "ss_address", label: "Physical Address", type: "text", gridCols: 1 },
            { key: "ss_city", label: "City", type: "text", gridCols: 1 },
            { key: "ss_state", label: "State/Province", type: "text", gridCols: 1 },
            { key: "ss_zip", label: "Zip Code/Postal Code", type: "text", gridCols: 1 },
            { key: "ss_country", label: "Country", type: "text", gridCols: 1 },
          ],
        },
        {
          title: "Item Details",
          fields: [
            { key: "ss_itemName", label: "Item Name", type: "text", required: true, gridCols: 1 },
            { key: "ss_countryOfOrigin", label: "Country of Origin", type: "text", gridCols: 1 },
            { key: "ss_shelfLife", label: "Shelf Life", type: "text", gridCols: 1 },
          ],
        },
        {
          title: "Product Questions (Q1–Q5)",
          fields: [
            { key: "ss_q1_organic", label: "1. Is this item Organic?", type: "radio", options: ["Yes", "No"] },
            { key: "ss_q2_vegetarian", label: "2. Is the item suitable for vegetarians?", type: "radio", options: ["Yes", "No"] },
            { key: "ss_q3_vegan", label: "3. Is the item suitable for vegan?", type: "radio", options: ["Yes", "No"] },
            { key: "ss_q4_halal", label: "4. Is the item Halal certified?", type: "radio", options: ["Yes", "No"] },
            { key: "ss_q4_halalCompliant", label: "If No, Is the item Halal compliant?", type: "radio", options: ["Yes", "No"] },
            { key: "ss_q5_kosher", label: "5. Is the item certified Kosher?", type: "radio", options: ["Yes", "No"] },
          ],
        },
      ],
    },
    {
      title: "Compliance & Ingredients",
      icon: "ClipboardCheck",
      sections: [
        {
          title: "Product Compliance (Q6–Q11)",
          fields: [
            { key: "ss_q6_prop65", label: "6. Is the item Proposition 65 compliant?", type: "radio", options: ["Yes", "No"] },
            { key: "ss_q7_gmo", label: "7. Are GMO/BE materials used in the production of the item?", type: "radio", options: ["Yes", "No"] },
            { key: "ss_q8_palm", label: "8. Does the supplied item contain Palm?", type: "radio", options: ["Yes", "No", "N/A"] },
            { key: "ss_q8_sustainable", label: "If yes, Is it sustainable?", type: "radio", options: ["Yes", "No"] },
            { key: "ss_q8_rspo", label: "RSPO (Roundtable on Sustainable Palm Oil) Certified?", type: "radio", options: ["Yes", "No"] },
            { key: "ss_q8_supplyChain", label: "Supply chain model used:", type: "checklist", options: ["Identity Preserved (IP)", "Segregation (SG)", "Mass Balance (MB)"] },
            { key: "ss_q9_irradiated", label: "9. Has the item been irradiated?", type: "radio", options: ["Yes", "No"] },
            { key: "ss_q10_sewage", label: "10. Is Sewage Sludge used in the production of the item?", type: "radio", options: ["Yes", "No"] },
            { key: "ss_q11_foodFraud", label: "11. Is the item susceptible to food fraud?", type: "radio", options: ["Yes", "No"] },
            { key: "ss_q11_riskType", label: "Type of risk:", type: "text", helpText: "If Yes, indicate the fraud risk type" },
            { key: "ss_q11_mitigation", label: "Mitigation measure:", type: "text" },
          ],
        },
        {
          title: "Ingredient Statement",
          description: "Suppliers must notify VIDA BUDDIES INC, of changes in product composition (e.g., protein content, moisture, amino acid profiles, contaminants levels, allergens, and/or other parameters that may vary by crop or by season).",
          fields: [
            { key: "ss_comp1_name", label: "Component 1 - Name", type: "text", gridCols: 1 },
            { key: "ss_comp1_pct", label: "Component 1 - Percentage", type: "text", gridCols: 1 },
            { key: "ss_comp1_origin", label: "Component 1 - Country of Origin", type: "text", gridCols: 1 },
            { key: "ss_comp2_name", label: "Component 2 - Name", type: "text", gridCols: 1 },
            { key: "ss_comp2_pct", label: "Component 2 - Percentage", type: "text", gridCols: 1 },
            { key: "ss_comp2_origin", label: "Component 2 - Country of Origin", type: "text", gridCols: 1 },
            { key: "ss_comp3_name", label: "Component 3 - Name", type: "text", gridCols: 1 },
            { key: "ss_comp3_pct", label: "Component 3 - Percentage", type: "text", gridCols: 1 },
            { key: "ss_comp3_origin", label: "Component 3 - Country of Origin", type: "text", gridCols: 1 },
          ],
        },
      ],
    },
    {
      title: "Allergens",
      icon: "Shield",
      sections: [
        {
          title: "Allergens and Sensitizing Agents",
          subtitle: "Answer all boxes with Yes or No. If Yes, the following documents are required: Allergen Control Program, Allergen Cleaning Program, Allergen Sanitation Validation Study",
          fields: [
            { key: "ss_alg_peanuts_product", label: "Peanuts (Including peanut oil) — In the product?", type: "radio", options: ["Yes", "No"] },
            { key: "ss_alg_peanuts_sameline", label: "Peanuts — On the same line?", type: "radio", options: ["Yes", "No"] },
            { key: "ss_alg_peanuts_facility", label: "Peanuts — In the facility?", type: "radio", options: ["Yes", "No"] },
            { key: "ss_alg_peanuts_source", label: "Peanuts — Source (if yes)", type: "text" },
            { key: "ss_alg_treenuts_product", label: "Tree Nuts (including coconut) — In the product?", type: "radio", options: ["Yes", "No"] },
            { key: "ss_alg_treenuts_sameline", label: "Tree Nuts — On the same line?", type: "radio", options: ["Yes", "No"] },
            { key: "ss_alg_treenuts_facility", label: "Tree Nuts — In the facility?", type: "radio", options: ["Yes", "No"] },
            { key: "ss_alg_treenuts_source", label: "Tree Nuts — Source (if yes)", type: "text" },
            { key: "ss_alg_milk_product", label: "Milk and derivatives — In the product?", type: "radio", options: ["Yes", "No"] },
            { key: "ss_alg_milk_sameline", label: "Milk — On the same line?", type: "radio", options: ["Yes", "No"] },
            { key: "ss_alg_milk_facility", label: "Milk — In the facility?", type: "radio", options: ["Yes", "No"] },
            { key: "ss_alg_milk_source", label: "Milk — Source (if yes)", type: "text" },
            { key: "ss_alg_eggs_product", label: "Eggs — In the product?", type: "radio", options: ["Yes", "No"] },
            { key: "ss_alg_eggs_sameline", label: "Eggs — On the same line?", type: "radio", options: ["Yes", "No"] },
            { key: "ss_alg_eggs_facility", label: "Eggs — In the facility?", type: "radio", options: ["Yes", "No"] },
            { key: "ss_alg_eggs_source", label: "Eggs — Source (if yes)", type: "text" },
            { key: "ss_alg_fish_product", label: "Fish — In the product?", type: "radio", options: ["Yes", "No"] },
            { key: "ss_alg_fish_sameline", label: "Fish — On the same line?", type: "radio", options: ["Yes", "No"] },
            { key: "ss_alg_fish_facility", label: "Fish — In the facility?", type: "radio", options: ["Yes", "No"] },
            { key: "ss_alg_fish_source", label: "Fish — Source (if yes)", type: "text" },
            { key: "ss_alg_shellfish_product", label: "Shellfish/Crustacean/Fish/Mollusk — In the product?", type: "radio", options: ["Yes", "No"] },
            { key: "ss_alg_shellfish_sameline", label: "Shellfish — On the same line?", type: "radio", options: ["Yes", "No"] },
            { key: "ss_alg_shellfish_facility", label: "Shellfish — In the facility?", type: "radio", options: ["Yes", "No"] },
            { key: "ss_alg_shellfish_source", label: "Shellfish — Source (if yes)", type: "text" },
            { key: "ss_alg_soy_product", label: "Soy — In the product?", type: "radio", options: ["Yes", "No"] },
            { key: "ss_alg_soy_sameline", label: "Soy — On the same line?", type: "radio", options: ["Yes", "No"] },
            { key: "ss_alg_soy_facility", label: "Soy — In the facility?", type: "radio", options: ["Yes", "No"] },
            { key: "ss_alg_soy_source", label: "Soy — Source (if yes)", type: "text" },
            { key: "ss_alg_wheat_product", label: "Wheat — In the product?", type: "radio", options: ["Yes", "No"] },
            { key: "ss_alg_wheat_sameline", label: "Wheat — On the same line?", type: "radio", options: ["Yes", "No"] },
            { key: "ss_alg_wheat_facility", label: "Wheat — In the facility?", type: "radio", options: ["Yes", "No"] },
            { key: "ss_alg_wheat_source", label: "Wheat — Source (if yes)", type: "text" },
            { key: "ss_alg_gluten_product", label: "Gluten (barley, rye, oats, spelt, or their hybridized strains) — In the product?", type: "radio", options: ["Yes", "No"] },
            { key: "ss_alg_gluten_sameline", label: "Gluten — On the same line?", type: "radio", options: ["Yes", "No"] },
            { key: "ss_alg_gluten_facility", label: "Gluten — In the facility?", type: "radio", options: ["Yes", "No"] },
            { key: "ss_alg_gluten_source", label: "Gluten — Source (if yes)", type: "text" },
            { key: "ss_alg_sulfites_product", label: "Sulfites (sodium sulfite, potassium metabisulfite) — In the product?", type: "radio", options: ["Yes", "No"] },
            { key: "ss_alg_sulfites_sameline", label: "Sulfites — On the same line?", type: "radio", options: ["Yes", "No"] },
            { key: "ss_alg_sulfites_facility", label: "Sulfites — In the facility?", type: "radio", options: ["Yes", "No"] },
            { key: "ss_alg_sulfites_source", label: "Sulfites — Source (if yes)", type: "text" },
            { key: "ss_alg_sesame_product", label: "Sesame, Celery, Lupin — In the product?", type: "radio", options: ["Yes", "No"] },
            { key: "ss_alg_sesame_sameline", label: "Sesame, Celery, Lupin — On the same line?", type: "radio", options: ["Yes", "No"] },
            { key: "ss_alg_sesame_facility", label: "Sesame, Celery, Lupin — In the facility?", type: "radio", options: ["Yes", "No"] },
            { key: "ss_alg_sesame_source", label: "Sesame, Celery, Lupin — Source (if yes)", type: "text" },
            { key: "ss_alg_mustard_product", label: "Mustard — In the product?", type: "radio", options: ["Yes", "No"] },
            { key: "ss_alg_mustard_sameline", label: "Mustard — On the same line?", type: "radio", options: ["Yes", "No"] },
            { key: "ss_alg_mustard_facility", label: "Mustard — In the facility?", type: "radio", options: ["Yes", "No"] },
            { key: "ss_alg_mustard_source", label: "Mustard — Source (if yes)", type: "text" },
            { key: "ss_alg_fdcyellow_product", label: "FD&C Yellow #5 (Tartrazine) — In the product?", type: "radio", options: ["Yes", "No"] },
            { key: "ss_alg_fdcyellow_sameline", label: "FD&C Yellow #5 — On the same line?", type: "radio", options: ["Yes", "No"] },
            { key: "ss_alg_fdcyellow_facility", label: "FD&C Yellow #5 — In the facility?", type: "radio", options: ["Yes", "No"] },
            { key: "ss_alg_fdcyellow_source", label: "FD&C Yellow #5 — Source (if yes)", type: "text" },
            { key: "ss_alg_meat_product", label: "Meat, Poultry — In the product?", type: "radio", options: ["Yes", "No"] },
            { key: "ss_alg_meat_sameline", label: "Meat, Poultry — On the same line?", type: "radio", options: ["Yes", "No"] },
            { key: "ss_alg_meat_facility", label: "Meat, Poultry — In the facility?", type: "radio", options: ["Yes", "No"] },
            { key: "ss_alg_meat_source", label: "Meat, Poultry — Source (if yes)", type: "text" },
          ],
        },
      ],
    },
    {
      title: "Declarations & Authorization",
      icon: "FileText",
      sections: [
        {
          title: "Flavor Suppliers",
          fields: [
            { key: "ss_flavor_natural", label: "Is this item a \"Natural Flavor\"?", type: "radio", options: ["Yes", "No", "N/A"] },
            { key: "ss_flavor_banned", label: "If No, do you affirm the product does not contain the following banned substances: Ethyl acrylate, Eugenyl methyl ether, Myrcene, Pulegone, Pyridine, Styrene?", type: "radio", options: ["Yes", "No"] },
            { key: "ss_flavor_compounds", label: "If No, please list compound(s):", type: "text" },
          ],
        },
        {
          title: "Packaging Suppliers",
          fields: [
            { key: "ss_packaging_affirm", label: "Do you affirm the product meets all regulations for food contact packaging, and does not contain the banned substance Benzophenone (also known as diphenylketone) (CAS No. 119-61-9)?", type: "radio", options: ["Yes", "No", "N/A"] },
          ],
        },
        {
          title: "Food Contact Chemical Suppliers",
          fields: [
            { key: "ss_chemical_foodgrade", label: "Do you affirm that the product is \"Food Grade\"?", type: "radio", options: ["Yes", "No", "N/A"] },
          ],
        },
        {
          title: "Authorization",
          subtitle: "Your typed name is your electronic signature",
          highlight: true,
          fields: [
            { key: "ss_auth_name", label: "Name (Print)", type: "text", required: true, gridCols: 1 },
            { key: "ss_auth_title", label: "Title", type: "text", required: true, gridCols: 1 },
          ],
        },
      ],
    },
  ],
};

export async function POST() {
  try {
    await connectToDatabase();
    const results = [];
    for (const tpl of [DEFAULT_TEMPLATE, SUPPLY_SURVEY_TEMPLATE]) {
      const existing = await SurveyTemplate.findOne({ templateId: tpl.templateId });
      if (!existing) {
        const created = await SurveyTemplate.create(tpl);
        results.push({ templateId: tpl.templateId, status: "created" });
      } else {
        results.push({ templateId: tpl.templateId, status: "exists" });
      }
    }
    return NextResponse.json({ message: "Seed complete", results });
  } catch (error) {
    console.error("Error seeding templates:", error);
    return NextResponse.json({ error: "Failed to seed templates" }, { status: 500 });
  }
}
