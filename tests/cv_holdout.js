// Second set of fictional CVs, written after the reader was tuned on cv_fixtures.js, to check it generalises.
module.exports = [
  {
    format: 'Indian labelled resume (Company / Designation / Duration)',
    text: `RESUME
Name: Deepak Sharma
Mobile: 9810098100
E-mail ID: deepak.sharma@example.com
Address: Sector 62, Noida, Uttar Pradesh

Career Objective:
To work as a credit analyst in a reputed bank.

Work Experience:
Company: Axis Bank Ltd.
Designation: Credit Manager – SME
Duration: Nov 2019 to Till Date
Key Responsibilities:
• Appraised SME credit proposals up to INR 25 crore.
• Monitored early warning signals for a portfolio of 150 accounts.

Company: Bajaj Finance Limited
Designation: Credit Analyst
Duration: Jun 2016 to Oct 2019
Key Responsibilities:
• Underwrote business loans.

Educational Qualification:
MBA (Finance) from Amity University, Noida in 2016
B.Com from Delhi University in 2014

Technical Skills:
MS Excel, Tally, SAP

Personal Details:
Date of Birth: 12 March 1992
Languages Known: English, Hindi`,
    expect: {
      name: 'Deepak Sharma', email: 'deepak.sharma@example.com', phone: '9810098100', city: 'Noida',
      experience: [
        { role: 'Credit Manager – SME', company: 'Axis Bank Ltd.', start: '2019-11' },
        { role: 'Credit Analyst', company: 'Bajaj Finance Limited', start: '2016-06' }],
      totalYears: 10.4, tools: ['MS Excel', 'Tally', 'SAP'], education: ['MBA', 'B.Com']
    }
  },
  {
    format: 'LinkedIn "Save to PDF" export',
    text: `Contact
www.linkedin.com/in/rohanverma (LinkedIn)
rohan.verma@example.com
Top Skills
Financial Analysis
Corporate Finance
Budgeting
Certifications
Financial Modeling & Valuation Analyst (FMVA)
Rohan Verma
Finance Manager at Swiggy
Bengaluru, Karnataka, India
Summary
Finance leader focused on unit economics and planning for consumer internet businesses.
Experience
Swiggy
Finance Manager
April 2022 - Present (4 years 7 months)
Bengaluru, Karnataka, India
Owned unit economics reporting for the food delivery business.
Bundl Technologies
Senior Financial Analyst
July 2019 - March 2022 (2 years 9 months)
Bengaluru, Karnataka, India
Education
Narsee Monjee Institute of Management Studies
Master of Business Administration - MBA, Finance · (2017 - 2019)
St. Xavier's College, Mumbai
Bachelor of Commerce - BCom · (2014 - 2017)`,
    expect: {
      name: 'Rohan Verma', email: 'rohan.verma@example.com', phone: '', linkedin: 'linkedin.com/in/rohanverma', city: 'Bengaluru',
      headline: 'Finance Manager at Swiggy',
      experience: [
        { role: 'Finance Manager', company: 'Swiggy', start: '2022-04' },
        { role: 'Senior Financial Analyst', company: 'Bundl Technologies', start: '2019-07' }],
      totalYears: 7.3, skills: ['Financial Analysis', 'Corporate Finance', 'Budgeting'],
      certifications: ['Financial Modeling & Valuation Analyst (FMVA)'],
      education: ['Master of Business Administration', 'Bachelor of Commerce']
    }
  },
  {
    format: 'Sales CV, company in capitals, "Since" and year-only dates',
    text: `MOHIT AGARWAL
Area Sales Manager
Jaipur | mohit.agarwal@example.com | +91 94140 55555

PROFESSIONAL SNAPSHOT
Sales leader with 10 years in FMCG distribution across Rajasthan.

EMPLOYMENT
DABUR INDIA LIMITED
Area Sales Manager, Since Jan 2020
• Grew territory revenue by 35% in three years.
ITC LIMITED
Territory Sales Officer, 2016 - 2019
• Managed 40 distributors across western Rajasthan.

EDUCATION
MBA (Marketing), Jaipuria Institute of Management, 2016

KEY SKILLS
Channel Sales | Distributor Management | Key Account Management | Team Handling`,
    expect: {
      name: 'Mohit Agarwal', email: 'mohit.agarwal@example.com', phone: '9414055555', city: 'Jaipur', headline: 'Area Sales Manager',
      experience: [
        { role: 'Area Sales Manager', company: 'DABUR INDIA LIMITED', start: '2020-01' },
        { role: 'Territory Sales Officer', company: 'ITC LIMITED', start: '2016-01' }],
      totalYears: 10.8, skills: ['Channel Sales', 'Distributor Management', 'Key Account Management'], education: ['MBA (Marketing)']
    }
  },
  {
    format: 'Strategy consulting, one line per job with location last',
    text: `Ishita Banerjee
Kolkata · ishita.banerjee@example.com · 98300 44444

Summary
Strategy consultant with private equity diligence experience.

Experience
Associate Director | Bain & Company | Jan 2020 – Present | Mumbai
Key Responsibilities:
- Led commercial due diligence for PE funds.
Consultant | Accenture Strategy | Aug 2016 – Dec 2019 | Kolkata
- Delivered cost reduction programmes.

Education
MBA, Indian School of Business, 2016
B.Tech (Electrical), Jadavpur University, 2012

Skills
Commercial due diligence, Market entry strategy, Excel, PowerPoint`,
    expect: {
      name: 'Ishita Banerjee', email: 'ishita.banerjee@example.com', phone: '9830044444', city: 'Kolkata',
      experience: [
        { role: 'Associate Director', company: 'Bain & Company', start: '2020-01' },
        { role: 'Consultant', company: 'Accenture Strategy', start: '2016-08' }],
      totalYears: 10.3, skills: ['Commercial due diligence', 'Market entry strategy'], tools: ['Excel', 'PowerPoint'],
      education: ['MBA', 'B.Tech (Electrical)']
    }
  },
  {
    format: 'HR CV, "Jan-2021" dates, no skills heading',
    text: `Fatima Sheikh
Pune, Maharashtra | fatima.sheikh@example.com | +91 98220 77777

EMPLOYMENT
HR Business Partner, Persistent Systems Ltd — Jan-2021 to Till Date
Handled employee relations and performance management for 1,200 engineers.
Senior HR Executive, Bajaj Auto Limited — Jul-2017 to Dec-2020
Ran campus hiring across 15 colleges.

EDUCATION
MBA (HR), Symbiosis Institute of Business Management, 2017

I am proficient in recruitment, payroll and HR analytics using Excel and Workday.`,
    expect: {
      name: 'Fatima Sheikh', email: 'fatima.sheikh@example.com', phone: '9822077777', city: 'Pune',
      experience: [
        { role: 'HR Business Partner', company: 'Persistent Systems Ltd', start: '2021-01' },
        { role: 'Senior HR Executive', company: 'Bajaj Auto Limited', start: '2017-07' }],
      totalYears: 9.3, skills: ['Recruitment', 'Payroll'], tools: ['Excel', 'Workday'], education: ['MBA (HR)']
    }
  },
  {
    format: 'Dates first, then title | company | city',
    text: `Karan Malhotra
Mumbai | karan.malhotra@example.com | +91 99300 66666

PROFILE
Corporate banker covering large corporates.

PROFESSIONAL EXPERIENCE
2021 - Present | Vice President, Corporate Banking | HDFC Bank Ltd | Mumbai
• Managed a loan book of INR 4,000 crore.
2018 - 2021 | Senior Analyst | Standard Chartered Bank | Mumbai
• Credit analysis for large corporates.

EDUCATION
PGDM (Finance), XLRI Jamshedpur, 2018
B.Com, Narsee Monjee College of Commerce and Economics, 2016

CERTIFICATIONS
FRM Part I`,
    expect: {
      name: 'Karan Malhotra', email: 'karan.malhotra@example.com', phone: '9930066666', city: 'Mumbai',
      experience: [
        { role: 'Vice President, Corporate Banking', company: 'HDFC Bank Ltd', start: '2021-01' },
        { role: 'Senior Analyst', company: 'Standard Chartered Bank', start: '2018-01' }],
      totalYears: 8.8, certifications: ['FRM'], education: ['PGDM (Finance)', 'B.Com']
    }
  }
];
