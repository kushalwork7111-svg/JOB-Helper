// Fictional CVs in the layouts most often seen online and in Indian hiring (Naukri, Harvard/US, Europass,
// two-column, table-based Word, UK, PDF-extracted, functional). Each lists what the CV reader must find.
// "Today" in tests is 19 Oct 2026, so "Present" means Oct 2026.
module.exports = [
  {
    format: 'Naukri-style, pipe-separated job lines',
    text: `RAHUL MEHTA
Mumbai, Maharashtra | +91 98200 12345 | rahul.mehta@email.com | linkedin.com/in/rahulmehta

PROFILE SUMMARY
Chartered Accountant with 12 years of experience in financial due diligence and valuation across consumer and financial services deals.

KEY SKILLS
Financial Due Diligence • Valuation • Financial Modelling • Quality of Earnings • Working Capital Analysis

IT SKILLS
MS Excel, PowerPoint, Power BI, Capital IQ

PROFESSIONAL EXPERIENCE
Grant Thornton Bharat LLP | Manager – Transaction Advisory | Mumbai | Apr 2021 – Present
• Led 15 buy-side due diligence engagements for private equity clients with deal values up to INR 2,000 crore.
• Built a quality of earnings toolkit adopted by the Mumbai deals team.
Ernst & Young LLP | Assistant Manager – Due Diligence | Mumbai | Jul 2017 – Mar 2021
• Delivered financial due diligence on 30 transactions in consumer and healthcare.
KPMG India | Article Assistant | Aug 2014 – Jun 2017
• Statutory audits of listed manufacturing companies.

EDUCATION
Chartered Accountant – ICAI – 2017
B.Com – University of Mumbai – 2014

CERTIFICATIONS
CFA Level II Candidate`,
    expect: {
      name: 'Rahul Mehta', email: 'rahul.mehta@email.com', phone: '9820012345', linkedin: 'linkedin.com/in/rahulmehta', city: 'Mumbai',
      experience: [
        { role: 'Manager – Transaction Advisory', company: 'Grant Thornton Bharat LLP', start: '2021-04' },
        { role: 'Assistant Manager – Due Diligence', company: 'Ernst & Young LLP', start: '2017-07' },
        { role: 'Article Assistant', company: 'KPMG India', start: '2014-08' }],
      totalYears: 12.3,
      skills: ['Financial Due Diligence', 'Valuation', 'Quality of Earnings'], tools: ['MS Excel', 'Power BI', 'Capital IQ'],
      certifications: ['CFA', 'Chartered Accountant'], education: ['Chartered Accountant', 'B.Com']
    }
  },
  {
    format: 'Harvard / US two-column with dates on the right',
    text: `JESSICA TAN
New York, NY • (212) 555-0147 • jessica.tan@example.com

EDUCATION
Columbia Business School                                   New York, NY
Master of Business Administration                          May 2016
University of Michigan                                     Ann Arbor, MI
Bachelor of Business Administration, Finance               May 2010

EXPERIENCE
McKinsey & Company                                          New York, NY
Engagement Manager                                          Sep 2019 – Present
- Led teams of 4-6 consultants on growth strategy for consumer goods clients
- Built a pricing diagnostic used across 12 client engagements
Associate                                                   Jul 2016 – Aug 2019
- Developed market sizing models for retail and technology clients
Goldman Sachs                                               New York, NY
Analyst, Investment Banking Division                        Jul 2010 – Jul 2014
- Executed 9 M&A transactions in consumer retail

SKILLS & INTERESTS
Skills: Financial modeling, Market sizing, Excel, PowerPoint, Tableau
Interests: Marathon running, Jazz piano`,
    expect: {
      name: 'Jessica Tan', email: 'jessica.tan@example.com', phone: '2125550147', city: 'New York',
      experience: [
        { role: 'Engagement Manager', company: 'McKinsey & Company', start: '2019-09' },
        { role: 'Associate', company: 'McKinsey & Company', start: '2016-07' },
        { role: 'Analyst, Investment Banking Division', company: 'Goldman Sachs', start: '2010-07' }],
      totalYears: 14.4,
      skills: ['Financial modeling', 'Market sizing'], tools: ['Excel', 'PowerPoint', 'Tableau'], notSkills: ['Marathon running'],
      education: ['Master of Business Administration', 'Bachelor of Business Administration']
    }
  },
  {
    format: 'Europass (labelled fields)',
    text: `Europass Curriculum Vitae

Personal information
Name: Marco Rossi
Address: Via Roma 10, Milan, Italy
Telephone: +39 02 1234 5678
E-mail: marco.rossi@example.it

Work experience
Dates: 03/2018 – present
Occupation or position held: Senior Financial Analyst
Name of employer: Pirelli & C. S.p.A.
Main activities and responsibilities: Budgeting, forecasting and variance analysis for the EMEA region.

Dates: 09/2014 – 02/2018
Occupation or position held: Financial Analyst
Name of employer: UniCredit S.p.A.
Main activities and responsibilities: Credit risk reporting for corporate lending portfolios.

Education and training
Dates: 2012 – 2014
Title of qualification awarded: Master of Science in Finance
Name of organisation providing education: Bocconi University

Personal skills
Mother tongue: Italian
Computer skills: SAP, Excel, Power BI, VBA`,
    expect: {
      name: 'Marco Rossi', email: 'marco.rossi@example.it', phone: '390212345678', city: 'Milan',
      experience: [
        { role: 'Senior Financial Analyst', company: 'Pirelli & C. S.p.A.', start: '2018-03' },
        { role: 'Financial Analyst', company: 'UniCredit S.p.A.', start: '2014-09' }],
      totalYears: 12.2,
      tools: ['SAP', 'Excel', 'Power BI', 'VBA'], notSkills: ['Italian'],
      education: ['Master of Science in Finance']
    }
  },
  {
    format: 'Functional CV with "Career History" one-liners',
    text: `PRIYA NAIR
Bengaluru | priya.nair@example.in | 9876543210

Career Objective
Seeking a senior FP&A role in a high-growth consumer business.

Core Competencies
- Budgeting and Forecasting
- Variance Analysis
- Stakeholder Management
- Process Improvement

Career History
2019 – Present: Flipkart Internet Pvt Ltd — Finance Manager, FP&A
Owned the annual operating plan for the marketplace business with a team of 4 analysts.
2015 – 2019: Hindustan Unilever Limited — Assistant Finance Manager
Managed commercial finance for the South India region.

Academic Qualifications
MBA (Finance), Indian Institute of Management Kozhikode, 2015
B.Com (Hons), Christ University, 2013`,
    expect: {
      name: 'Priya Nair', email: 'priya.nair@example.in', phone: '9876543210', city: 'Bengaluru',
      experience: [
        { role: 'Finance Manager, FP&A', company: 'Flipkart Internet Pvt Ltd', start: '2019-01' },
        { role: 'Assistant Finance Manager', company: 'Hindustan Unilever Limited', start: '2015-01' }],
      totalYears: 11.8,
      skills: ['Budgeting and Forecasting', 'Variance Analysis', 'Stakeholder Management'],
      education: ['MBA (Finance)', 'B.Com (Hons)']
    }
  },
  {
    format: 'Fresher / graduate with internships',
    text: `Ananya Gupta
ananya.gupta@example.com | +91-99999-88888 | LinkedIn: linkedin.com/in/ananya-gupta | Pune

OBJECTIVE
Commerce graduate seeking an analyst role in audit or consulting.

EDUCATION
Bachelor of Commerce (B.Com), Symbiosis College of Arts and Commerce, Pune — 2025 — CGPA 8.6/10
Higher Secondary (Class XII), Commerce — Delhi Public School, Pune — 2022 — 92%

INTERNSHIPS
Audit Intern, Deloitte Haskins & Sells LLP, Pune (May 2024 – Jul 2024)
• Assisted in statutory audit of two manufacturing clients.
Finance Intern, Tata Motors Limited (Dec 2023 – Jan 2024)
• Prepared monthly variance reports for the plant controller.

SKILLS
Tally ERP 9; Advanced Excel; GST Compliance; Financial Statement Analysis

CERTIFICATIONS
NISM Series V-A: Mutual Fund Distributors
Google Data Analytics Professional Certificate`,
    expect: {
      name: 'Ananya Gupta', email: 'ananya.gupta@example.com', phone: '919999988888', linkedin: 'linkedin.com/in/ananya-gupta', city: 'Pune',
      experience: [
        { role: 'Audit Intern', company: 'Deloitte Haskins & Sells LLP', start: '2024-05' },
        { role: 'Finance Intern', company: 'Tata Motors Limited', start: '2023-12' }],
      totalYears: 0,
      skills: ['GST Compliance', 'Financial Statement Analysis'], tools: ['Tally ERP 9', 'Advanced Excel'],
      certifications: ['NISM Series V-A: Mutual Fund Distributors', 'Google Data Analytics Professional Certificate'],
      education: ['Bachelor of Commerce', 'Higher Secondary (Class XII)']
    }
  },
  {
    format: 'Two-column template (sidebar text comes first)',
    text: `CONTACT
vikram.s@example.com
+91 90000 11111
Gurugram, Haryana
linkedin.com/in/vikramsingh

SKILLS
Private Equity
Portfolio Monitoring
Financial Modelling
Excel
PitchBook

VIKRAM SINGH
Vice President – Private Equity

EXPERIENCE
Vice President
Kotak Investment Advisors Limited
Jan 2022 – Present
• Evaluated 40+ mid-market investment opportunities and closed 3 deals.
Associate
Avendus Capital Private Limited
Jun 2018 – Dec 2021
• Executed sell-side M&A mandates in consumer and healthcare.

EDUCATION
PGDM, Indian Institute of Management Lucknow, 2018
B.Tech, Delhi Technological University, 2014

CERTIFICATIONS
CFA Charterholder`,
    expect: {
      name: 'Vikram Singh', email: 'vikram.s@example.com', phone: '919000011111', linkedin: 'linkedin.com/in/vikramsingh', city: 'Gurugram',
      headline: 'Vice President – Private Equity',
      experience: [
        { role: 'Vice President', company: 'Kotak Investment Advisors Limited', start: '2022-01' },
        { role: 'Associate', company: 'Avendus Capital Private Limited', start: '2018-06' }],
      totalYears: 8.4,
      skills: ['Private Equity', 'Portfolio Monitoring', 'Financial Modelling'], tools: ['Excel', 'PitchBook'], notSkills: ['VIKRAM SINGH', 'Vice President – Private Equity'],
      certifications: ['CFA Charterholder'], education: ['PGDM', 'B.Tech']
    }
  },
  {
    format: '"Role at Company" with dates on the next line',
    text: `Sameer Khan
Hyderabad, India
sameer.khan@example.com · +91 91234 56789

Professional Summary
Supply chain professional with 9 years in e-commerce and pharmaceuticals, focused on inventory optimisation.

Work History
Senior Supply Chain Analyst at Amazon Development Centre India Pvt Ltd
June 2020 to Present
- Reduced inventory holding costs by 12% through demand-driven replenishment.
Supply Chain Analyst at Dr. Reddy's Laboratories Ltd.
August 2017 to May 2020
- Ran S&OP for 3 manufacturing sites.

Education
MBA, Operations — Symbiosis Institute of Operations Management, 2017
Bachelor of Engineering (Mechanical) — Osmania University, 2015

Technical Skills
SQL | Python | Tableau | SAP MM | Advanced Excel
Functional: Demand planning, Inventory optimisation, S&OP`,
    expect: {
      name: 'Sameer Khan', email: 'sameer.khan@example.com', phone: '919123456789', city: 'Hyderabad',
      experience: [
        { role: 'Senior Supply Chain Analyst', company: 'Amazon Development Centre India Pvt Ltd', start: '2020-06' },
        { role: 'Supply Chain Analyst', company: "Dr. Reddy's Laboratories Ltd.", start: '2017-08' }],
      totalYears: 9.3,
      skills: ['Demand planning', 'Inventory optimisation', 'S&OP'], tools: ['SQL', 'Python', 'Tableau', 'SAP MM', 'Advanced Excel'],
      education: ['MBA', 'Bachelor of Engineering (Mechanical)']
    }
  },
  {
    format: 'Consulting CV with promotions under one employer',
    text: `Neha Kapoor, CA
Chennai · neha.kapoor@example.com · +91 98410 22222

SUMMARY
Value creation and operational due diligence consultant for private equity portfolio companies.

EXPERIENCE
Deloitte Touche Tohmatsu India LLP, Chennai
Manager, Value Creation Services (Oct 2022 – Present)
• Delivered cost transformation programmes worth INR 150 crore of savings.
Assistant Manager, Financial Advisory (Jul 2019 – Sep 2022)
• Led operational due diligence workstreams on 10 deals.
PwC India, Chennai
Senior Associate, Deals (Feb 2017 – Jun 2019)
• Supported buy-side financial due diligence.

QUALIFICATIONS
Chartered Accountant, ICAI (2016)
B.Com, Loyola College, Chennai (2013)

SKILLS
Operational due diligence, Cost transformation, Working capital optimisation, Alteryx, Excel`,
    expect: {
      name: 'Neha Kapoor', email: 'neha.kapoor@example.com', phone: '919841022222', city: 'Chennai',
      experience: [
        { role: 'Manager, Value Creation Services', company: 'Deloitte Touche Tohmatsu India LLP', start: '2022-10' },
        { role: 'Assistant Manager, Financial Advisory', company: 'Deloitte Touche Tohmatsu India LLP', start: '2019-07' },
        { role: 'Senior Associate, Deals', company: 'PwC India', start: '2017-02' }],
      totalYears: 9.8,
      skills: ['Operational due diligence', 'Cost transformation'], tools: ['Alteryx', 'Excel'],
      certifications: ['Chartered Accountant'], education: ['Chartered Accountant', 'B.Com']
    }
  },
  {
    format: 'Word table converted to text (tab-separated)',
    text: `Curriculum Vitae
Name\tArjun Reddy
Email\tarjun.reddy@example.com
Mobile\t+91 70000 33333
Current Location\tBengaluru
Total Experience\t9 years

Employment Details
Organisation\tDesignation\tDuration
Infosys Limited\tSenior Associate Consultant\tJan 2020 - Present
Wipro Limited\tAnalyst\tJul 2017 - Dec 2019

Educational Qualifications
Degree\tInstitute\tYear
MBA\tChrist University\t2017
BBA\tSt. Joseph's College\t2015

Key Skills
Business analysis, Requirement gathering, SQL, JIRA, Agile`,
    expect: {
      name: 'Arjun Reddy', email: 'arjun.reddy@example.com', phone: '917000033333', city: 'Bengaluru',
      experience: [
        { role: 'Senior Associate Consultant', company: 'Infosys Limited', start: '2020-01' },
        { role: 'Analyst', company: 'Wipro Limited', start: '2017-07' }],
      totalYears: 9.3,
      skills: ['Business analysis', 'Requirement gathering', 'Agile'], tools: ['SQL', 'JIRA'],
      education: ['MBA', 'BBA']
    }
  },
  {
    format: 'UK CV with mm.yyyy dates and "Career" heading',
    text: `Oliver Bennett
London, UK | +44 7700 900123 | oliver.bennett@example.co.uk

Personal Statement
Restructuring professional advising lenders and corporates through turnaround situations.

Career
FTI Consulting LLP — Director, Corporate Finance & Restructuring — 05.2021 – present
• Led independent business reviews for UK mid-market lenders.
Alvarez & Marsal Europe LLP — Senior Associate — 09.2016 – 04.2021
• Built 13-week cash flow models for distressed retailers.

Education
BSc Economics, London School of Economics, 2012–2015

Qualifications
ACA (ICAEW)`,
    expect: {
      name: 'Oliver Bennett', email: 'oliver.bennett@example.co.uk', phone: '447700900123', city: 'London',
      experience: [
        { role: 'Director, Corporate Finance & Restructuring', company: 'FTI Consulting LLP', start: '2021-05' },
        { role: 'Senior Associate', company: 'Alvarez & Marsal Europe LLP', start: '2016-09' }],
      totalYears: 10.2,
      certifications: ['ACA'], education: ['BSc Economics']
    }
  },
  {
    format: 'Marketing CV (non-finance), title above company',
    text: `Kavya Iyer
Digital Marketing Manager
Mumbai • kavya.iyer@example.com • +91 98765 01234

ABOUT ME
Performance marketer with 8 years across beauty e-commerce and agency roles.

WORK EXPERIENCE
Digital Marketing Manager
Nykaa E-Retail Private Limited, Mumbai
March 2021 - Present
• Managed a monthly paid media budget of INR 3 crore across Google and Meta.
Marketing Executive
Ogilvy & Mather, Mumbai
June 2018 - February 2021
• Ran social campaigns for FMCG brands.

SKILLS
SEO, SEM, Google Analytics, Meta Ads Manager, HubSpot, Content Strategy, Canva

EDUCATION
PGDM (Marketing), MICA Ahmedabad, 2018
BMS, Mithibai College, 2016`,
    expect: {
      name: 'Kavya Iyer', email: 'kavya.iyer@example.com', phone: '919876501234', city: 'Mumbai', headline: 'Digital Marketing Manager',
      experience: [
        { role: 'Digital Marketing Manager', company: 'Nykaa E-Retail Private Limited', start: '2021-03' },
        { role: 'Marketing Executive', company: 'Ogilvy & Mather', start: '2018-06' }],
      totalYears: 8.4,
      skills: ['SEO', 'SEM', 'Content Strategy'], tools: ['Google Analytics', 'Meta Ads Manager', 'HubSpot', 'Canva'],
      education: ['PGDM (Marketing)', 'BMS']
    }
  },
  {
    format: 'PDF text extract (odd bullets, wrapped lines, page footer)',
    text: `SURESH BABU K
Senior Auditor
Kochi, Kerala
Ph: +91-94470-12345   Email: suresh.babu@example.com

Experience Summary
 12+ years in statutory and internal audit for banks and NBFCs

Professional Experience
Senior Manager – Internal Audit
Muthoot Finance Ltd.                    Apr'19 – Present
 Led risk-based internal audits across 120 branches and
reported findings to the Audit Committee.
 Implemented continuous auditing for gold loan disbursals.
Page 1 of 2
Audit Manager
Federal Bank Ltd.                       Jun'14 – Mar'19
 Managed concurrent audit of treasury operations.

Education
Chartered Accountant, ICAI, 2013
B.Com, Mahatma Gandhi University, 2010

Skills: Internal Audit, Risk Based Auditing, IFC Testing, SAP, IDEA`,
    expect: {
      name: 'Suresh Babu K', email: 'suresh.babu@example.com', phone: '919447012345', city: 'Kochi', headline: 'Senior Auditor',
      experience: [
        { role: 'Senior Manager – Internal Audit', company: 'Muthoot Finance Ltd.', start: '2019-04' },
        { role: 'Audit Manager', company: 'Federal Bank Ltd.', start: '2014-06' }],
      totalYears: 12.4,
      skills: ['Internal Audit', 'Risk Based Auditing', 'IFC Testing'], tools: ['SAP', 'IDEA'],
      certifications: ['Chartered Accountant'], education: ['Chartered Accountant', 'B.Com']
    }
  }
];
