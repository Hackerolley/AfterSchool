import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  ClipboardList,
  CircleHelp,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  School,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import AssignmentPage from "./AssignmentPage.jsx";
import {
  apiGet,
  apiPost,
  getPlatformSession,
  getSchoolSession,
  login,
  logout,
} from "./api.js";

const SCHOOL_KEY = "afterschool.school";
const MODE_KEY = "afterschool.mode";
const roleNames = { admin: "School admin", teacher: "Teacher", student: "Student" };
const navigation = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "classes", label: "My classes", icon: School },
  { id: "courses", label: "Courses", icon: BookOpen },
  { id: "people", label: "People", icon: Users, adminOnly: true },
  { id: "assignments", label: "Assignments", icon: ClipboardList, roleOnly: ["teacher", "student"] },
];
const dayLabel = new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric" }).format(new Date());

function assignmentDueLabel(date) {
  if (!date) return "No due date";
  const due = new Date(date);
  return Number.isNaN(due.getTime())
    ? "No due date"
    : `Due ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(due)}`;
}

function readSchool() {
  try {
    return JSON.parse(localStorage.getItem(SCHOOL_KEY) || "null");
  } catch {
    localStorage.removeItem(SCHOOL_KEY);
    return null;
  }
}

function fullName(user) {
  return [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Welcome";
}

function initials(user) {
  return [user?.firstName?.[0], user?.lastName?.[0]].filter(Boolean).join("").toUpperCase() || "AS";
}

function App() {
  const [auth, setAuth] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const handleUnauthorized = () => {
      localStorage.removeItem(MODE_KEY);
      localStorage.removeItem(SCHOOL_KEY);
      sessionStorage.removeItem("afterschool.csrf");
      setAuth(null);
    };
    window.addEventListener("afterschool:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("afterschool:unauthorized", handleUnauthorized);
  }, []);

  useEffect(() => {
    let active = true;
    const mode = localStorage.getItem(MODE_KEY);
    const school = readSchool();
    const restore = mode === "platform"
      ? getPlatformSession()
      : school?.id
        ? getSchoolSession(school.id).then((payload) => ({ ...payload.data, mode: "school", school }))
        : Promise.reject(new Error("No school session"));

    restore
      .then((data) => {
        if (!active) return;
        setAuth(mode === "platform" ? { ...data.data, mode } : data);
      })
      .catch(() => {
        localStorage.removeItem(MODE_KEY);
        localStorage.removeItem(SCHOOL_KEY);
      })
      .finally(() => {
        if (active) setCheckingSession(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleLogin = async (credentials) => {
    const data = await login(credentials);
    const nextAuth = { ...data, mode: credentials.mode };
    localStorage.setItem(MODE_KEY, credentials.mode);
    if (credentials.mode === "school") {
      const school = {
        id: data.organization.id,
        slug: data.organization.slug,
        name: data.organization.name,
      };
      localStorage.setItem(SCHOOL_KEY, JSON.stringify(school));
      nextAuth.school = school;
    } else {
      localStorage.removeItem(SCHOOL_KEY);
    }
    setAuth(nextAuth);
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // Clear the local view even if the session expired or the API is offline.
    }
    localStorage.removeItem(MODE_KEY);
    localStorage.removeItem(SCHOOL_KEY);
    setAuth(null);
  };

  if (checkingSession) return <LoadingScreen />;
  if (!auth) {
    return <LoginScreen onLogin={handleLogin} />;
  }
  if (auth.mode === "platform") {
    return <PlatformDashboard auth={auth} onLogout={handleLogout} />;
  }
  return <SchoolDashboard auth={auth} onLogout={handleLogout} />;
}

function LoadingScreen() {
  return (
    <main className="loading-screen">
      <div className="brand-mark"><GraduationCap size={24} /></div>
      <div className="loading-line" />
      <p>Getting your school ready…</p>
    </main>
  );
}

function Brand({ compact = false }) {
  return (
    <div className={`brand ${compact ? "brand-compact" : ""}`}>
      <span className="brand-mark"><GraduationCap size={21} strokeWidth={2.1} /></span>
      <span className="brand-name">after<span>school</span></span>
    </div>
  );
}

function LoginScreen({ onLogin }) {
  const [mode, setMode] = useState("school");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organizationSlug, setOrganizationSlug] = useState("");
  const [pending, setPending] = useState(false);
  const [localError, setLocalError] = useState("");
  const currentWeek = Array.from({ length: 5 }, (_, index) => {
    const date = new Date();
    const weekday = date.getDay();
    const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
    date.setDate(date.getDate() + mondayOffset + index);
    return { label: new Intl.DateTimeFormat("en", { weekday: "short" }).format(date).toUpperCase(), today: date.toDateString() === new Date().toDateString() };
  });

  async function submit(event) {
    event.preventDefault();
    setPending(true);
    setLocalError("");
    try {
      await onLogin({ mode, email: email.trim(), password, organizationSlug: organizationSlug.trim() });
    } catch (requestError) {
      setLocalError(requestError.message);
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-story">
        <div className="story-top"><Brand /><span className="story-chip"><span className="live-dot" /> A calmer school day</span></div>
        <div className="story-content">
          <p className="eyebrow light-eyebrow"><Sparkles size={14} /> SCHOOL, IN SYNC</p>
          <h1>More room<br />for <em>what matters.</em></h1>
          <p className="story-copy">Bring your school community together. Make the everyday feel a little easier.</p>
          <div className="story-board">
            <div className="board-heading"><span>YOUR SCHOOL, AT A GLANCE</span><span className="board-period">THIS WEEK <ChevronDown size={12} /></span></div>
            <div className="board-stats">
              <div><span className="board-icon mint"><Users size={16} /></span><strong>One community</strong><small>Students, teachers, families</small></div>
              <div><span className="board-icon peach"><BookOpen size={16} /></span><strong>One clear view</strong><small>Classes and learning together</small></div>
            </div>
            <div className="week-strip">{currentWeek.map((day) => <span className={day.today ? "today" : ""} key={day.label}>{day.label}{day.today && <i />}</span>)}</div>
          </div>
        </div>
        <div className="story-foot"><span>Built around your school community</span><span>01 — 03</span></div>
      </section>

      <section className="login-side">
        <div className="login-mobile-brand"><Brand /></div>
        <div className="login-box">
          <div className="login-heading">
            <span className="login-icon"><ShieldCheck size={21} /></span>
            <p className="eyebrow">WELCOME BACK</p>
            <h2>{mode === "platform" ? <>Sign in to your<br />platform console.</> : <>Sign in to your<br />school space.</>}</h2>
            <p className="muted">{mode === "platform" ? "Manage school workspaces securely." : "Your school day starts right here."}</p>
          </div>
          <div className="login-switch" role="tablist" aria-label="Account type">
            <button className={mode === "school" ? "selected" : ""} onClick={() => { setMode("school"); setLocalError(""); }} role="tab" aria-selected={mode === "school"} type="button">School account</button>
            <button className={mode === "platform" ? "selected" : ""} onClick={() => { setMode("platform"); setLocalError(""); }} role="tab" aria-selected={mode === "platform"} type="button">Platform admin</button>
          </div>
          <form className="login-form" onSubmit={submit}>
            {mode === "school" && (
              <label className="field">
                <span>School slug</span>
                <div className="input-wrap"><School size={17} /><input required autoComplete="organization" placeholder="your-school-name" value={organizationSlug} onChange={(event) => setOrganizationSlug(event.target.value.toLowerCase())} /></div>
                <small>Enter the slug provided by your school administrator, e.g. learn-on-the-go.</small>
              </label>
            )}
            <label className="field">
              <span>Email address</span>
              <div className="input-wrap"><span className="input-at">@</span><input required type="email" autoComplete="username" placeholder="you@school.com" value={email} onChange={(event) => setEmail(event.target.value)} /></div>
            </label>
            <label className="field">
              <span>Password</span>
              <input className="plain-input" required type="password" autoComplete="current-password" placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
            {localError && <div className="form-error" role="alert">{localError}</div>}
            <button className="button button-primary login-submit" type="submit" disabled={pending}>
              {pending ? <><span className="spinner" /> Signing you in…</> : <>Continue to your dashboard <ArrowRight size={17} /></>}
            </button>
          </form>
          <div className="login-help"><CircleHelp size={15} /><span>Need access? Ask your school administrator to set up your account.</span></div>
        </div>
        <footer className="login-footer"><span>© {new Date().getFullYear()} Afterschool</span><span>Made for the moments that matter.</span></footer>
      </section>
    </main>
  );
}

function SchoolDashboard({ auth, onLogout }) {
  const [activePage, setActivePage] = useState("overview");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [data, setData] = useState({ classes: [], courses: [], students: [], teachers: [], assignments: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [details, setDetails] = useState(null);
  const role = auth.role;
  const orgId = auth.school.id;
  const person = auth.user;
  const availableNavigation = navigation
    .filter((item) => (!item.adminOnly || role === "admin" || (item.id === "people" && role === "teacher"))
      && (!item.roleOnly || item.roleOnly.includes(role)))
    .map((item) => role === "teacher" && item.id === "people" ? { ...item, label: "My students" } : item);
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const jobs = [
      apiGet("/classes?limit=100", orgId),
      apiGet("/courses?limit=100", orgId),
      apiGet("/assignments?limit=100", orgId),
    ];
    if (role === "admin") jobs.push(apiGet("/students?limit=100", orgId), apiGet("/teachers?limit=100", orgId));
    if (role === "teacher" && (activePage === "people" || activePage === "overview")) {
      jobs.push(apiGet("/students?limit=100", orgId));
    }
    Promise.all(jobs)
      .then((results) => {
        if (!active) return;
        setData({
          classes: results[0].data || [],
          courses: results[1].data || [],
          assignments: results[2]?.data || [],
          students: role === "admin" ? results[3]?.data || [] : role === "teacher" ? results[3]?.data || [] : [],
          teachers: role === "admin" ? results[4]?.data || [] : [],
        });
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [orgId, role, refreshKey, activePage]);

  const refresh = () => setRefreshKey((value) => value + 1);
  const showNotice = (text) => {
    setNotice(text);
    window.setTimeout(() => setNotice(""), 3500);
  };

  async function submitCreate(payload) {
    const { type, ...body } = payload;
    if (type === "student" || type === "teacher") {
      const path = type === "student" ? "/students" : "/teachers";
      await apiPost(path, { ...body, role: type }, orgId);
      showNotice(`${type === "student" ? "Student" : "Teacher"} added to your school.`);
    } else if (type === "course") {
      await apiPost("/courses", body, orgId);
      showNotice("Course created.");
    } else if (type === "class") {
      await apiPost("/classes", body, orgId);
      showNotice("Class created.");
    } else if (type === "enroll") {
      await apiPost(`/classes/${body.classId}/enrollments`, { studentMembershipId: body.studentMembershipId }, orgId);
      showNotice("Student enrolled in class.");
    }
    setDialog("");
    refresh();
  }

  const openClass = (schoolClass) => setDetails({ type: "class", item: schoolClass });
  const openPerson = (type, personRecord) => setDetails({ type, item: personRecord });

  const visibleClasses = data.classes.filter((item) => {
    const text = `${item.name} ${item.course?.name || ""} ${item.course?.code || ""}`.toLowerCase();
    return text.includes(search.toLowerCase());
  });

  return (
    <div className="dashboard-layout">
      <aside className={`sidebar ${mobileNavOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand"><Brand /><button className="icon-button sidebar-close" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)}><X size={18} /></button></div>
        <div className="school-picker"><div className="school-monogram">{auth.school.name?.[0] || "S"}</div><div className="school-picker-copy"><strong>{auth.school.name}</strong><span>School workspace</span></div><ChevronDown size={15} /></div>
        <p className="nav-label">WORKSPACE</p>
        <nav className="side-nav" aria-label="Main navigation">
          {availableNavigation.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-item ${activePage === id ? "nav-active" : ""}`} onClick={() => { setActivePage(id); setMobileNavOpen(false); }}>
              <Icon size={18} strokeWidth={1.9} /><span>{label}</span>{id === "classes" && <span className="nav-count">{data.classes.length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="term-card"><span className="term-badge"><Activity size={14} /> SCHOOL YEAR</span><strong>Learning in progress</strong><span>Small steps make big things.</span><div className="term-progress"><i /></div></div>
          <button className="nav-item settings-item" onClick={() => showNotice("School settings are coming soon.")}><Settings2 size={18} /><span>Settings</span></button>
          <div className="sidebar-user">
            <div className="avatar avatar-dark">{initials(person)}</div>
            <div className="sidebar-user-copy"><strong>{fullName(person)}</strong><span>{roleNames[role]}</span></div>
            <button className="icon-button logout-icon" title="Sign out" aria-label="Sign out" onClick={onLogout}><LogOut size={17} /></button>
          </div>
        </div>
      </aside>

      {mobileNavOpen && <button className="mobile-overlay" aria-label="Close navigation overlay" onClick={() => setMobileNavOpen(false)} />}
      <main className="main-panel">
        <header className="topbar">
          <button className="icon-button menu-button" aria-label="Open navigation" onClick={() => setMobileNavOpen(true)}><Menu size={20} /></button>
          <div className="breadcrumbs"><span>Workspace</span><span className="crumb-divider">/</span><strong>{availableNavigation.find((item) => item.id === activePage)?.label}</strong></div>
          <div className="topbar-right"><span className="date-label"><CalendarDays size={15} />{dayLabel}</span><span className="topbar-separator" /><div className="avatar avatar-soft" title={fullName(person)}>{initials(person)}</div><button className="icon-button top-logout" title="Sign out" aria-label="Sign out" onClick={onLogout}><LogOut size={17} /></button></div>
        </header>

        <div className="dashboard-content">
          <div className="welcome-row">
            <div><p className="eyebrow">{dayLabel.toUpperCase()}</p><h1>{greeting}, {person.firstName}<span className="wave">✳</span></h1><p className="muted welcome-subtitle">{role === "admin" ? "Here's what's happening across your school." : role === "teacher" ? "Your classes and learners, all in one place." : "Your learning journey, all in one place."}</p></div>
            {role === "admin" && <button className="button button-primary create-button" onClick={() => setDialog(activePage === "classes" ? "class" : activePage === "courses" ? "course" : "student")}><Plus size={17} />{activePage === "classes" ? "New class" : activePage === "courses" ? "New course" : "Add student"}</button>}
          </div>

          {error && <div className="error-banner" role="alert"><span>{error}</span><button className="button button-small" onClick={refresh}>Try again</button></div>}
          {notice && <div className="notice-banner" role="status"><Check size={17} />{notice}<button aria-label="Dismiss notification" onClick={() => setNotice("")}><X size={16} /></button></div>}

          {activePage === "overview" && <Overview role={role} data={data} loading={loading} onNavigate={setActivePage} onEnroll={() => setDialog("enroll")} onOpenClass={openClass} />}
          {activePage === "classes" && <ClassesPage role={role} classes={visibleClasses} loading={loading} search={search} setSearch={setSearch} onEnroll={() => setDialog("enroll")} onOpenClass={openClass} />}
          {activePage === "courses" && <CoursesPage courses={data.courses} loading={loading} role={role} onCreate={() => setDialog("course")} />}
          {activePage === "people" && <PeoplePage role={role} data={data} loading={loading} onCreate={(type) => setDialog(type)} onOpenPerson={openPerson} search={search} setSearch={setSearch} />}
          {activePage === "assignments" && <AssignmentPage role={role} assignments={data.assignments} classes={data.classes} loading={loading} organizationId={orgId} onRefresh={refresh} />}
          <footer className="content-footer"><span>© {new Date().getFullYear()} Afterschool</span><span>School, in sync.</span></footer>
        </div>
      </main>

      {dialog && <ActionDialog type={dialog} courses={data.courses} teachers={data.teachers} students={data.students} classes={data.classes} onClose={() => setDialog("")} onSubmit={submitCreate} />}
      {details && <DetailsDialog details={details} organizationId={orgId} onClose={() => setDetails(null)} />}
    </div>
  );
}

function Overview({ role, data, loading, onNavigate, onEnroll, onOpenClass }) {
  const cards = [
    { label: "My classes", value: data.classes.length, icon: School, tone: "green", trend: role === "admin" ? "Across your school" : "Ready to explore", page: "classes" },
    { label: "Courses", value: data.courses.length, icon: BookOpen, tone: "peach", trend: "Learning paths", page: "courses" },
    ...(role === "admin" ? [
      { label: "Students", value: data.students.length, icon: GraduationCap, tone: "blue", trend: "In your community", page: "people" },
      { label: "Teachers", value: data.teachers.length, icon: Users, tone: "lavender", trend: "Supporting learners", page: "people" },
    ] : role === "teacher" ? [
      { label: "My students", value: data.students.length, icon: Users, tone: "blue", trend: "Across your classes", page: "people" },
    ] : []),
    ...(role === "teacher" || role === "student" ? [
      { label: "Assignments", value: data.assignments.length, icon: ClipboardList, tone: "lavender", trend: role === "teacher" ? "For your classes" : "Ready for you", page: "assignments" },
    ] : []),
  ];
  return (
    <>
      <div className={`metric-grid ${cards.length === 3 ? "metric-three" : ""}`}>
        {cards.map(({ label, value, icon: Icon, tone, trend, page }, index) => (
          <button className="metric-card" key={label} onClick={() => onNavigate(page)} style={{ animationDelay: `${index * 70}ms` }}>
            <div className="metric-top"><span>{label}</span><span className={`metric-icon ${tone}`}><Icon size={18} /></span></div>
            <div className="metric-value">{loading ? <span className="skeleton-number" /> : value}</div>
            <div className="metric-foot"><span>{trend}</span><span className="metric-arrow"><ArrowUpRight size={15} /></span></div>
          </button>
        ))}
      </div>

      {(role === "teacher" || role === "student") && <div className="section-row"><div><p className="eyebrow">YOUR LEARNING SPACE</p><h2>Assignments</h2></div><button className="text-button" onClick={() => onNavigate("assignments")}>View all <ArrowRight size={15} /></button></div>}
      {!(role === "teacher" || role === "student") && <div className="section-row"><div><p className="eyebrow">YOUR LEARNING SPACE</p><h2>Classes to keep you moving</h2></div><button className="text-button" onClick={() => onNavigate("classes")}>View all <ArrowRight size={15} /></button></div>}
      {(role === "teacher" || role === "student") && (loading ? <LoadingCards /> : data.assignments.length === 0 ? <EmptyState icon={ClipboardList} title={role === "teacher" ? "Your classes are ready for assignments" : "No assignments yet"} text={role === "teacher" ? "Create assignments for the classes you teach." : "Assignments shared with your classes will appear here."} action={role === "teacher" ? <button className="button button-primary button-small" onClick={() => onNavigate("assignments")}><ClipboardList size={15} />Open assignments</button> : null} /> : (
        <div className="assignment-list overview-assignment-list">{data.assignments.slice(0, 3).map((assignment) => <article className="assignment-card" key={assignment._id}><span className="assignment-icon assignment-text"><ClipboardList size={19} /></span><div className="assignment-card-copy"><div className="assignment-card-heading"><h3>{assignment.title}</h3>{assignment.submission && <span className="assignment-state submitted">Submitted</span>}</div><p>{assignment.class?.name || "Class"}</p><small>{assignmentDueLabel(assignment.dueAt)}</small></div><button className="icon-button assignment-open" onClick={() => onNavigate("assignments")} aria-label="Open assignments"><ArrowUpRight size={18} /></button></article>)}</div>
      ))}
      <div className="section-row"><div><p className="eyebrow">YOUR LEARNING SPACE</p><h2>{role === "admin" ? "Classes to keep you moving" : "Your classes"}</h2></div><button className="text-button" onClick={() => onNavigate("classes")}>View all <ArrowRight size={15} /></button></div>
      {loading ? <LoadingCards /> : data.classes.length === 0 ? <EmptyState icon={School} title="Your classes will appear here" text={role === "admin" ? "Create a class, assign a teacher, and invite learners to get started." : "There are no classes linked to your account yet."} action={role === "admin" ? <button className="button button-primary button-small" onClick={() => onNavigate("classes")}><Plus size={15} />Create a class</button> : null} /> : (
        <div className="class-grid">
          {data.classes.slice(0, 3).map((schoolClass, index) => <ClassCard key={schoolClass._id} schoolClass={schoolClass} index={index} onOpen={() => onOpenClass(schoolClass)} />)}
        </div>
      )}

      <div className="bottom-grid">
        <div className="panel learning-panel"><div className="panel-heading"><div><p className="eyebrow">A LITTLE REMINDER</p><h3>Every step counts.</h3></div><span className="sparkle-stamp"><Sparkles size={18} /></span></div><p>Progress isn't always a straight line. Keep showing up, keep asking questions, and celebrate the small wins along the way.</p><div className="panel-signoff"><span className="signoff-mark">a.</span><span>We're cheering you on.</span></div></div>
        <div className="panel quick-panel"><div><p className="eyebrow">QUICK ACCESS</p><h3>Pick up where you left off</h3></div><div className="quick-links"><button onClick={() => onNavigate("courses")}><span className="quick-icon peach"><BookOpen size={17} /></span><span><strong>Browse courses</strong><small>Find your learning path</small></span><ArrowRight size={16} /></button><button onClick={() => onNavigate("classes")}><span className="quick-icon green"><School size={17} /></span><span><strong>Explore classes</strong><small>See what's on your schedule</small></span><ArrowRight size={16} /></button></div></div>
      </div>
    </>
  );
}

function ClassCard({ schoolClass, index, onOpen }) {
  const tones = ["class-art-mint", "class-art-peach", "class-art-blue"];
  const art = [<BookOpen key="book" />, <Sparkles key="spark" />, <GraduationCap key="cap" />][index % 3];
  const teacher = schoolClass.teacher?.user;
  const teacherName = teacher ? fullName(teacher) : "Teacher not assigned";
  return (
    <button className="class-card" onClick={onOpen} aria-label={`View ${schoolClass.name} class roster`}>
      <div className={`class-art ${tones[index % 3]}`}><span className="class-art-orbit orbit-one" /><span className="class-art-orbit orbit-two" /><span className="class-art-icon">{art}</span><span className="class-code">{schoolClass.course?.code || "CLASS"}</span></div>
      <div className="class-card-content"><div className="class-title-row"><div><h3>{schoolClass.name}</h3><p>{schoolClass.course?.name || "Course"}</p></div><span className="small-circle"><ArrowUpRight size={15} /></span></div><div className="class-card-meta"><span><Users size={14} />{schoolClass.enrolledCount || 0} learners</span><span className="teacher-avatar">{teacher ? initials(teacher) : "—"}</span>{teacherName}</div></div>
    </button>
  );
}

function ClassesPage({ role, classes, loading, search, setSearch, onEnroll, onOpenClass }) {
  return (
    <>
      <div className="page-heading"><div><p className="eyebrow">THE PEOPLE & PLACES</p><h2>Classes</h2><p className="muted">A home for curiosity, community, and a little bit of magic.</p></div><div className="search-control"><Search size={16} /><input aria-label="Search classes" placeholder="Find a class…" value={search} onChange={(event) => setSearch(event.target.value)} /></div></div>
      {loading ? <LoadingCards /> : classes.length === 0 ? <EmptyState icon={School} title="No classes found" text={role === "admin" ? "Try another search or create a class to get started." : "No classes match your search. Try another name or course."} /> : <div className="class-grid class-grid-all">{classes.map((item, index) => <ClassCard key={item._id} schoolClass={item} index={index} onOpen={() => onOpenClass(item)} />)}</div>}
      {role === "admin" && <div className="inline-hint"><span className="hint-icon"><Users size={17} /></span><span><strong>Quick enrollment</strong><small>Add an existing student to one of your classes.</small></span><button className="text-button" onClick={onEnroll}>Enroll a student <ArrowRight size={15} /></button></div>}
    </>
  );
}

function CoursesPage({ courses, loading, role, onCreate }) {
  return (
    <>
      <div className="page-heading"><div><p className="eyebrow">GROW AT YOUR OWN PACE</p><h2>Courses</h2><p className="muted">Every new idea opens another door.</p></div>{role === "admin" && <button className="button button-primary" onClick={onCreate}><Plus size={17} />New course</button>}</div>
      {loading ? <LoadingCards /> : courses.length === 0 ? <EmptyState icon={BookOpen} title="Your course library is ready" text={role === "admin" ? "Add your first course and start shaping the school curriculum." : "Courses connected to your classes will show up here."} action={role === "admin" ? <button className="button button-primary button-small" onClick={onCreate}><Plus size={15} />Create a course</button> : null} /> : (
        <div className="course-list">{courses.map((course, index) => <article className="course-row" key={course._id}><div className={`course-illustration course-tone-${index % 4}`}><BookOpen size={21} /></div><div className="course-main"><div className="course-title-line"><h3>{course.name}</h3><span className="course-status"><i />{course.status}</span></div><p>{course.description || "A space to discover, practise, and grow."}</p></div><span className="course-code">{course.code}</span><span className="course-row-arrow"><ArrowUpRight size={17} /></span></article>)}</div>
      )}
    </>
  );
}

function PeoplePage({ role, data, loading, onCreate, onOpenPerson, search, setSearch }) {
  const [kind, setKind] = useState("students");
  const entries = kind === "students" ? data.students : data.teachers;
  const filtered = entries.filter((entry) => {
    const text = `${entry.user?.firstName || ""} ${entry.user?.lastName || ""} ${entry.user?.email || ""}`.toLowerCase();
    return text.includes(search.toLowerCase());
  });
  return (
    <>
      <div className="page-heading"><div><p className="eyebrow">YOUR SCHOOL COMMUNITY</p><h2>{role === "teacher" ? "My students" : "People"}</h2><p className="muted">The people who make your school what it is.</p></div>{role === "admin" && <button className="button button-primary" onClick={() => onCreate(kind === "students" ? "student" : "teacher")}><Plus size={17} />Add {kind === "students" ? "student" : "teacher"}</button>}</div>
      <div className="people-toolbar"><div className="segmented"><button className={kind === "students" ? "active" : ""} onClick={() => setKind("students")}>Students <span>{data.students.length}</span></button>{role === "admin" && <button className={kind === "teachers" ? "active" : ""} onClick={() => setKind("teachers")}>Teachers <span>{data.teachers.length}</span></button>}</div><div className="search-control"><Search size={16} /><input aria-label="Search people" placeholder="Search by name or email" value={search} onChange={(event) => setSearch(event.target.value)} /></div></div>
      {loading ? <LoadingCards /> : filtered.length === 0 ? <EmptyState icon={Users} title={`No ${kind} to show yet`} text={role === "admin" ? `Add your first ${kind.slice(0, -1)} to grow your school community.` : "Your class community will appear here."} action={role === "admin" ? <button className="button button-primary button-small" onClick={() => onCreate(kind === "students" ? "student" : "teacher")}><Plus size={15} />Add {kind.slice(0, -1)}</button> : null} /> : (
        <div className="people-list">{filtered.map((entry, index) => <article className="person-row" key={entry._id}><span className={`avatar person-avatar person-tone-${index % 5}`}>{initials(entry.user)}</span><span className="person-info"><strong>{fullName(entry.user)}</strong><small>{entry.user?.email}</small></span><span className="person-detail">{kind === "students" ? entry.profile?.studentNumber || "Student" : entry.profile?.specialization || "Teacher"}</span><span className={`status-pill ${entry.status}`}>{entry.status}</span><button className="icon-button person-action" aria-label={`View ${fullName(entry.user)} details`} onClick={() => onOpenPerson(kind === "students" ? "student" : "teacher", entry)}><ArrowUpRight size={17} /></button></article>)}</div>
      )}
    </>
  );
}

function PlatformDashboard({ auth, onLogout }) {
  const [dialog, setDialog] = useState(false);
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  async function createSchool(body) {
    setPending(true);
    try {
      const result = await apiPost("/platform/organizations", {
        name: body.name,
        slug: body.slug,
        admin: body.admin,
      });
      setNotice(`“${result.data.organization.name}” is ready. Its school administrator can now sign in.`);
      setDialog(false);
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="dashboard-layout platform-layout">
      <aside className="sidebar">
        <div className="sidebar-brand"><Brand /></div>
        <div className="platform-tag"><ShieldCheck size={15} /> PLATFORM CONSOLE</div>
        <p className="nav-label">MANAGE</p>
        <nav className="side-nav"><button className="nav-item nav-active"><School size={18} /><span>Organizations</span></button></nav>
        <div className="sidebar-bottom"><div className="sidebar-user"><div className="avatar avatar-dark">{initials(auth.user)}</div><div className="sidebar-user-copy"><strong>{fullName(auth.user)}</strong><span>Platform admin</span></div><button className="icon-button logout-icon" title="Sign out" aria-label="Sign out" onClick={onLogout}><LogOut size={17} /></button></div></div>
      </aside>
      <main className="main-panel">
        <header className="topbar"><div className="breadcrumbs"><span>Platform</span><span className="crumb-divider">/</span><strong>Organizations</strong></div><div className="topbar-right"><span className="platform-user-label"><span className="live-dot" />Platform access</span><span className="topbar-separator" /><div className="avatar avatar-soft">{initials(auth.user)}</div></div></header>
        <div className="dashboard-content platform-content">
          <div className="welcome-row"><div><p className="eyebrow">PLATFORM CONSOLE</p><h1>Good to see you, {auth.user.firstName}<span className="wave">✳</span></h1><p className="muted welcome-subtitle">Set up a new school and welcome its first administrator.</p></div><button className="button button-primary" onClick={() => setDialog(true)}><Plus size={17} />Create a school</button></div>
          {notice && <div className="notice-banner"><Check size={17} />{notice}<button aria-label="Dismiss notification" onClick={() => setNotice("")}><X size={16} /></button></div>}
          <section className="platform-welcome"><span className="platform-welcome-icon"><School size={26} /></span><div><p className="eyebrow">A NEW COMMUNITY STARTS HERE</p><h2>Every school has a story.</h2><p>Create its workspace and appoint a school administrator to get things moving.</p></div><button className="button button-dark" onClick={() => setDialog(true)}>Set up a school <ArrowRight size={16} /></button></section>
          <div className="platform-note"><ShieldCheck size={17} /><span><strong>Platform-level access</strong><small>You can provision schools here. School learning records stay inside each school's tenant.</small></span></div>
          <footer className="content-footer"><span>© {new Date().getFullYear()} Afterschool</span><button className="text-button" onClick={onLogout}>Sign out <LogOut size={14} /></button></footer>
        </div>
      </main>
      {dialog && <ActionDialog type="organization" pending={pending} onClose={() => setDialog(false)} onSubmit={createSchool} />}
    </div>
  );
}

function ActionDialog({ type, courses = [], teachers = [], students = [], classes = [], onClose, onSubmit, pending = false }) {
  const config = {
    student: { title: "Welcome a student", subtitle: "Create their account and student profile.", button: "Add student" },
    teacher: { title: "Welcome a teacher", subtitle: "Create their account and teaching profile.", button: "Add teacher" },
    course: { title: "Create a course", subtitle: "Add a new subject to your school.", button: "Create course" },
    class: { title: "Create a class", subtitle: "Choose a course, teacher, and class size.", button: "Create class" },
    enroll: { title: "Enroll a student", subtitle: "Add a student to one of your classes.", button: "Enroll student" },
    organization: { title: "Create a school", subtitle: "Set up a workspace and its first administrator.", button: "Create school" },
  }[type];
  const [formError, setFormError] = useState("");
  const [selectedClass, setSelectedClass] = useState(classes[0]?._id || "");
  const [gender, setGender] = useState("");

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === "Escape" && !pending) onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, pending]);

  async function submit(event) {
    event.preventDefault();
    setFormError("");
    const formData = new FormData(event.currentTarget);
    const value = (key) => String(formData.get(key) || "").trim();
    const body = { type };
    if (type === "student" || type === "teacher") {
      Object.assign(body, {
        firstName: value("firstName"),
        lastName: value("lastName"),
        email: value("email"),
      });
      if (value("password")) body.password = value("password");
      if (type === "student") {
        for (const key of ["dateOfBirth", "gender", "genderDescription", "countryOfResidence", "homeCountry", "phoneNumber", "studentNumber", "guardianName", "guardianEmail", "guardianPhone"]) {
          const current = value(key);
          if (current) body[key] = current;
        }
      } else {
        if (value("employeeId")) body.employeeId = value("employeeId");
        if (value("specialization")) body.specialization = value("specialization");
      }
    } else if (type === "course") {
      body.name = value("name");
      body.code = value("code");
      body.description = value("description");
    } else if (type === "class") {
      body.name = value("name");
      body.courseId = value("courseId");
      body.teacherMembershipId = value("teacherMembershipId");
      body.capacity = Number(value("capacity") || 30);
    } else if (type === "enroll") {
      body.classId = selectedClass;
      body.studentMembershipId = value("studentMembershipId");
    } else {
      body.name = value("name");
      body.slug = value("slug").toLowerCase();
      body.admin = {
        firstName: value("adminFirstName"),
        lastName: value("adminLastName"),
        email: value("adminEmail"),
        password: value("adminPassword"),
      };
    }
    try {
      await onSubmit(body);
    } catch (error) {
      setFormError(error.message);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <div className="modal-heading"><div><p className="eyebrow">SCHOOL WORKSPACE</p><h2 id="dialog-title">{config.title}</h2><p>{config.subtitle}</p></div><button className="icon-button modal-close" aria-label="Close dialog" onClick={onClose}><X size={19} /></button></div>
        <form className="modal-form" onSubmit={submit}>
          {(type === "student" || type === "teacher") && <>
            <div className="form-two"><FormField label="First name"><input autoFocus required name="firstName" autoComplete="given-name" /></FormField><FormField label="Last name"><input required name="lastName" autoComplete="family-name" /></FormField></div>
            <FormField label="Email address"><input required type="email" name="email" autoComplete="email" /></FormField>
            <FormField label="Temporary password"><input minLength="12" maxLength="128" type="password" name="password" autoComplete="new-password" /><small>For a new account, enter at least 12 characters. Leave blank to add an account that already exists in another school.</small></FormField>
            {type === "student" && <>
              <div className="form-section-title">STUDENT DETAILS <span>OPTIONAL</span></div>
              <div className="form-two"><FormField label="Date of birth"><input type="date" name="dateOfBirth" max={new Date().toISOString().slice(0, 10)} /></FormField><FormField label="Phone number"><input name="phoneNumber" type="tel" placeholder="+44 20 1234 5678" /></FormField></div>
              <div className="form-two"><FormField label="Gender"><select name="gender" value={gender} onChange={(event) => setGender(event.target.value)}><option value="">Select gender</option><option value="female">Female</option><option value="male">Male</option><option value="non_binary">Non-binary</option><option value="self_described">Self-described</option><option value="prefer_not_to_say">Prefer not to say</option></select></FormField><FormField label="If self-described"><input name="genderDescription" required={gender === "self_described"} maxLength="80" placeholder="Your description" disabled={gender !== "self_described"} /></FormField></div>
              <div className="form-two"><FormField label="Country of residence"><input name="countryOfResidence" maxLength="2" placeholder="GB" /></FormField><FormField label="Home country"><input name="homeCountry" maxLength="2" placeholder="NG" /></FormField></div>
              <FormField label="Student number"><input name="studentNumber" maxLength="40" /></FormField>
              <div className="form-section-title">GUARDIAN CONTACT <span>OPTIONAL</span></div>
              <FormField label="Guardian name"><input name="guardianName" /></FormField>
              <div className="form-two"><FormField label="Guardian email"><input type="email" name="guardianEmail" /></FormField><FormField label="Guardian phone"><input type="tel" name="guardianPhone" /></FormField></div>
            </>}
            {type === "teacher" && <><div className="form-section-title">TEACHER DETAILS <span>OPTIONAL</span></div><div className="form-two"><FormField label="Employee ID"><input name="employeeId" /></FormField><FormField label="Specialization"><input name="specialization" /></FormField></div></>}
          </>}
          {type === "course" && <><FormField label="Course name"><input autoFocus required name="name" maxLength="120" placeholder="e.g. English language" /></FormField><FormField label="Course code"><input required name="code" maxLength="32" placeholder="e.g. ENG-101" /></FormField><FormField label="Description"><textarea name="description" rows="3" maxLength="2000" placeholder="What will students explore in this course?" /></FormField></>}
          {type === "class" && <><FormField label="Class name"><input autoFocus required name="name" maxLength="120" placeholder="e.g. Year 8 · Blue group" /></FormField><FormField label="Course"><select required name="courseId" defaultValue=""><option value="" disabled>Choose a course</option>{courses.map((item) => <option key={item._id} value={item._id}>{item.name} · {item.code}</option>)}</select>{courses.length === 0 && <small>Create a course first to use it in a class.</small>}</FormField><FormField label="Assigned teacher"><select required name="teacherMembershipId" defaultValue=""><option value="" disabled>Choose a teacher</option>{teachers.map((item) => <option key={item._id} value={item._id}>{fullName(item.user)}</option>)}</select>{teachers.length === 0 && <small>Add a teacher first to assign one to this class.</small>}</FormField><FormField label="Class capacity"><input type="number" required name="capacity" min="1" max="1000" defaultValue="30" /></FormField></>}
          {type === "enroll" && <><FormField label="Class"><select required value={selectedClass} onChange={(event) => setSelectedClass(event.target.value)}><option value="" disabled>Choose a class</option>{classes.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select>{classes.length === 0 && <small>Create a class before enrolling students.</small>}</FormField><FormField label="Student"><select required name="studentMembershipId" defaultValue=""><option value="" disabled>Choose a student</option>{students.map((item) => <option key={item._id} value={item._id}>{fullName(item.user)} · {item.user?.email}</option>)}</select>{students.length === 0 && <small>Add a student before enrolling.</small>}</FormField></>}
          {type === "organization" && <><div className="form-two"><FormField label="School name"><input autoFocus required name="name" maxLength="120" placeholder="e.g. Northfield Academy" /></FormField><FormField label="School slug"><input required name="slug" maxLength="80" pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="northfield-academy" /><small>Used when school members sign in.</small></FormField></div><div className="form-section-title">FIRST SCHOOL ADMIN</div><div className="form-two"><FormField label="First name"><input required name="adminFirstName" /></FormField><FormField label="Last name"><input required name="adminLastName" /></FormField></div><FormField label="Admin email"><input required type="email" name="adminEmail" /></FormField><FormField label="Temporary password"><input required minLength="12" maxLength="128" type="password" name="adminPassword" autoComplete="new-password" /><small>At least 12 characters. Share it securely with the administrator.</small></FormField></>}
          {formError && <div className="form-error" role="alert">{formError}</div>}
          <div className="modal-actions"><button className="button button-quiet" type="button" onClick={onClose}>Cancel</button><button className="button button-primary" type="submit" disabled={pending || (type === "class" && (!courses.length || !teachers.length)) || (type === "enroll" && (!classes.length || !students.length))}>{pending ? <><span className="spinner" />Saving…</> : <>{config.button}<ArrowRight size={16} /></>}</button></div>
        </form>
      </section>
    </div>
  );
}

function DetailsDialog({ details, organizationId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const classView = details.type === "class";
  const endpoint = classView
    ? `/classes/${details.item._id}/students?limit=100`
    : `/${details.type === "student" ? "students" : "teachers"}/${details.item._id}`;

  useEffect(() => {
    let active = true;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    apiGet(endpoint, organizationId)
      .then((result) => {
        if (active) setData(result.data);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [endpoint, onClose, organizationId]);

  const title = classView ? details.item.name : fullName(details.item.user);
  const profile = classView ? null : data?.profile;
  const enrollmentRows = classView && Array.isArray(data) ? data : [];
  const hasProfileDetails = Boolean(profile && [
    profile.studentNumber,
    profile.employeeId,
    profile.specialization,
    profile.dateOfBirth,
    profile.gender,
    profile.countryOfResidence,
    profile.homeCountry,
    profile.phoneNumber,
    profile.guardianName,
    profile.guardianEmail,
    profile.guardianPhone,
    profile.qualifications?.length,
  ].some(Boolean));
  const genderNames = {
    female: "Female",
    male: "Male",
    non_binary: "Non-binary",
    self_described: "Self-described",
    prefer_not_to_say: "Prefer not to say",
  };

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="modal details-modal" role="dialog" aria-modal="true" aria-labelledby="details-title">
        <div className="modal-heading">
          <div>
            <p className="eyebrow">{classView ? "CLASS ROSTER" : details.type === "student" ? "STUDENT PROFILE" : "TEACHER PROFILE"}</p>
            <h2 id="details-title">{title}</h2>
            <p>{classView ? `${details.item.course?.name || "Class"} · ${details.item.course?.code || ""}` : details.item.user?.email}</p>
          </div>
          <button className="icon-button modal-close" aria-label="Close details" onClick={onClose}><X size={19} /></button>
        </div>
        {loading ? <div className="details-loading"><span className="spinner details-spinner" />Loading details…</div> : error ? <div className="form-error details-error" role="alert">{error}</div> : classView ? (
          <>
            <div className="details-summary">
              <DetailItem label="Assigned teacher" value={fullName(details.item.teacher?.user)} />
              <DetailItem label="Enrollment" value={`${details.item.enrolledCount || enrollmentRows.length} / ${details.item.capacity} students`} />
            </div>
            <p className="form-section-title">ACTIVE STUDENTS <span>{enrollmentRows.length}</span></p>
            {enrollmentRows.length ? (
              <div className="details-roster">{enrollmentRows.map((enrollment) => {
                const student = enrollment.student?.user;
                return (
                  <div className="details-roster-row" key={enrollment._id}>
                    <span className="avatar person-avatar">{initials(student)}</span>
                    <span className="person-info"><strong>{fullName(student)}</strong><small>{student?.email}</small></span>
                    <span className="person-detail">{enrollment.enrolledAt ? new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(enrollment.enrolledAt)) : ""}</span>
                  </div>
                );
              })}</div>
            ) : <p className="details-empty">No students are currently enrolled in this class.</p>}
          </>
        ) : (
          <>
            <div className="details-summary">
              <DetailItem label="School role" value={details.type === "student" ? "Student" : "Teacher"} />
              {profile?.studentNumber && <DetailItem label="Student number" value={profile.studentNumber} />}
              {profile?.employeeId && <DetailItem label="Employee ID" value={profile.employeeId} />}
              {profile?.specialization && <DetailItem label="Specialization" value={profile.specialization} />}
              {profile?.dateOfBirth && <DetailItem label="Date of birth" value={new Intl.DateTimeFormat("en", { dateStyle: "long", timeZone: "UTC" }).format(new Date(profile.dateOfBirth))} />}
              {profile?.gender && <DetailItem label="Gender" value={profile.gender === "self_described" ? profile.genderDescription : genderNames[profile.gender] || profile.gender} />}
              {profile?.countryOfResidence && <DetailItem label="Country of residence" value={profile.countryOfResidence} />}
              {profile?.homeCountry && <DetailItem label="Home country" value={profile.homeCountry} />}
              {profile?.phoneNumber && <DetailItem label="Phone number" value={profile.phoneNumber} />}
              {profile?.qualifications?.length > 0 && <DetailItem label="Qualifications" value={profile.qualifications.join(", ")} />}
            </div>
            {details.type === "student" && (profile?.guardianName || profile?.guardianEmail || profile?.guardianPhone) && (
              <>
                <p className="form-section-title">GUARDIAN CONTACT</p>
                <div className="details-summary">
                  {profile.guardianName && <DetailItem label="Guardian" value={profile.guardianName} />}
                  {profile.guardianEmail && <DetailItem label="Email" value={profile.guardianEmail} />}
                  {profile.guardianPhone && <DetailItem label="Phone" value={profile.guardianPhone} />}
                </div>
              </>
            )}
            {!hasProfileDetails && <p className="details-empty">No additional profile details have been added.</p>}
          </>
        )}
        <div className="modal-actions"><button className="button button-quiet" onClick={onClose}>Close</button></div>
      </section>
    </div>
  );
}

function DetailItem({ label, value }) {
  return <div className="detail-item"><span>{label}</span><strong>{value}</strong></div>;
}

function FormField({ label, children }) {
  return <label className="form-field"><span>{label}</span>{children}</label>;
}

function LoadingCards() {
  return <div className="class-grid">{[0, 1, 2].map((item) => <div className="skeleton-card" key={item}><div /><span /><i /></div>)}</div>;
}

function EmptyState({ icon: Icon, title, text, action }) {
  return <div className="empty-state"><span className="empty-icon"><Icon size={22} /></span><h3>{title}</h3><p>{text}</p>{action}</div>;
}

export default App;
