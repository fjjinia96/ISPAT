/* Sample data shown in DEMO MODE (before Supabase is set up). Same shape as parseWorkbook() output. */
export function demoData() {
  const TODAY = new Date(); TODAY.setHours(0, 0, 0, 0);
  const day = (n) => { const d = new Date(TODAY); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const DATA = {
  ngoabOnline: 65,
  years: {
    '2025': {
      budget: 600000, spent: 444000,
      components: [
        { name:'Governance & Policy Reform', budget:250000, spent:198000 },
        { name:'Capacity Building', budget:200000, spent:150000 },
        { name:'Digital Systems', budget:150000, spent:96000 }
      ],
      beneficiaries: { male:4200, female:3800 },
      trainingPlanned: 12,
      ngo: [
        { name:'Financial Management', venue:'Dhaka', date:'2025-01-12', male:20, female:15, pre:45, post:78 },
        { name:'M&E Fundamentals', venue:'Chattogram', date:'2025-02-18', male:12, female:16, pre:52, post:81 },
        { name:'Proposal Writing', venue:'Sylhet', date:'2025-03-05', male:10, female:12, pre:48, post:75 },
        { name:'Safeguarding Basics', venue:'Khulna', date:'2025-05-20', male:14, female:18, pre:39, post:80 },
        { name:'Donor Reporting', venue:'Dhaka', date:'2025-08-11', male:17, female:13, pre:50, post:84 }
      ],
      ngoab: [
        { name:'Regulatory Compliance', venue:'Dhaka', date:'2025-01-20', male:25, female:15, pre:40, post:72 },
        { name:'Digital Record Keeping', venue:'Rajshahi', date:'2025-03-14', male:18, female:12, pre:55, post:83 },
        { name:'Online Registration System', venue:'Dhaka', date:'2025-06-02', male:21, female:14, pre:35, post:79 },
        { name:'Risk Based Monitoring', venue:'Cox\'s Bazar', date:'2025-09-16', male:16, female:11, pre:42, post:76 }
      ],
      policy: [
        { name:'NGO Registration Policy Review', venue:'Dhaka', date:'2025-01-15', male:28, female:17 },
        { name:'Digital Transformation Dialogue', venue:'Dhaka', date:'2025-02-22', male:35, female:25 },
        { name:'Gender Inclusion in Governance', venue:'Chattogram', date:'2025-03-10', male:15, female:23 },
        { name:'NGOAB Reform Consultation', venue:'Dhaka', date:'2025-04-05', male:30, female:22 }
      ],
      workshop: [
        { name:'Capacity Building Workshop', venue:'Dhaka', date:'2025-01-08', male:20, female:15 },
        { name:'M&E Framework Workshop', venue:'Sylhet', date:'2025-02-19', male:14, female:14 },
        { name:'Financial Systems Workshop', venue:'Rajshahi', date:'2025-03-03', male:25, female:17 },
        { name:'Annual Review Workshop', venue:'Dhaka', date:'2025-07-24', male:22, female:19 },
        { name:'Data Quality Workshop', venue:'Khulna', date:'2025-10-09', male:13, female:15 }
      ]
    },
    '2026': {
      budget: 750000, spent: 210000,
      components: [
        { name:'Governance & Policy Reform', budget:300000, spent:96000 },
        { name:'Capacity Building', budget:250000, spent:70000 },
        { name:'Digital Systems', budget:200000, spent:44000 }
      ],
      beneficiaries: { male:1900, female:2100 },
      trainingPlanned: 14,
      ngo: [
        { name:'Leadership for NGO Managers', venue:'Dhaka', date:'2026-02-10', male:16, female:19, pre:44, post:79 },
        { name:'Procurement Essentials', venue:'Barishal', date:'2026-04-22', male:15, female:12, pre:51, post:82 },
        { name:'Gender Mainstreaming', venue:'Rangpur', date:'2026-07-14', male:9, female:21, pre:46, post:85 }
      ],
      ngoab: [
        { name:'Case Management System', venue:'Dhaka', date:'2026-03-18', male:19, female:13, pre:38, post:77 },
        { name:'Data Protection Basics', venue:'Dhaka', date:'2026-09-08', male:17, female:15, pre:43, post:80 }
      ],
      policy: [
        { name:'Foreign Donation Act Review', venue:'Dhaka', date:'2026-02-25', male:31, female:20 },
        { name:'Civil Society Space Dialogue', venue:'Dhaka', date:'2026-06-12', male:26, female:29 }
      ],
      workshop: [
        { name:'Work Planning Workshop 2026', venue:'Dhaka', date:'2026-01-20', male:24, female:18 },
        { name:'Digital Literacy Workshop', venue:'Mymensingh', date:'2026-05-07', male:15, female:20 },
        { name:'Mid Year Reflection Workshop', venue:'Sylhet', date:'2026-08-19', male:18, female:16 }
      ]
    },
    '2027': null
  },
  activities: [
    { name:'Leadership for NGO Managers', cat:'Training', date:'2026-02-10', status:'Completed' },
    { name:'Foreign Donation Act Review', cat:'Policy Dialogue', date:'2026-02-25', status:'Completed' },
    { name:'Gender Mainstreaming', cat:'Training', date:'2026-07-14', status:'Completed' },
    { name:'Data Protection Basics', cat:'Training', date:'2026-09-08', status:'Completed' },
    { name:'Quarterly Progress Review', cat:'Other', date:day(-12), status:'Not started' },
    { name:'Grievance Redress Training (NGOAB)', cat:'Training', date:day(-4), status:'Not started' },
    { name:'NGOAB Online Solution: Pilot Launch', cat:'Other', date:day(-1), status:'Ongoing' },
    { name:'Youth Engagement Policy Dialogue', cat:'Policy Dialogue', date:day(2), status:'Not started' },
    { name:'Climate Finance Training (NGO)', cat:'Training', date:day(5), status:'Not started' },
    { name:'Partners Coordination Workshop', cat:'Workshop', date:day(11), status:'Not started' },
    { name:'Annual Planning Workshop 2027', cat:'Workshop', date:day(22), status:'Not started' },
    { name:'Audit Readiness Training (NGO)', cat:'Training', date:day(30), status:'Not started' }
  ],
  achievements: [
    { icon:'registration', text:'40% reduction in registration time', tag:'Efficiency' },
    { icon:'policy', text:'Policy translated into Bangla', tag:'Policy & Accessibility' },
    { icon:'reached', text:'8,000 beneficiaries reached', tag:'Reach' },
    { icon:'training', text:'18 trainings completed', tag:'Capacity Building' }
  ]
  };
  DATA.yearList = Object.keys(DATA.years).sort();
  DATA.lastUpdated = null;
  return DATA;
}
