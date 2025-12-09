import React, { useState, useEffect } from 'react';
import {
    Play,
    FolderOpen,
    CheckCircle,
    Circle,
    Trash2,
    Edit3,
    ChevronRight,
    Monitor,
    Layout,
    Video,
    Menu,
    X
} from 'lucide-react';

// --- Interfaces & Types ---

interface Lesson {
    id: string;
    fileKey: string;
    originalName: string;
    title: string;
    isCompleted: boolean;
    duration: number;
}

interface Module {
    id: string;
    title: string;
    lessons: Lesson[];
}

interface Course {
    id: string;
    title: string;
    modules: Module[];
    createdAt: string;
}

interface ActiveVideo extends Lesson {
    url: string;
}

// --- Utility Components ---

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
    children: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({ children, variant = 'primary', className = '', ...props }) => {
    const baseStyle = "px-4 py-2 rounded-md font-medium transition-all duration-200 flex items-center justify-center gap-2 text-sm";
    const variants = {
        primary: "bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-900/20",
        secondary: "bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700",
        ghost: "bg-transparent hover:bg-zinc-800 text-zinc-400 hover:text-white",
        danger: "bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20",
        outline: "border border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-800/50"
    };
    return (
        <button className={`${baseStyle} ${variants[variant]} ${className}`} {...props}>
            {children}
        </button>
    );
};

const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
    <div className={`bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden ${className}`}>
        {children}
    </div>
);

const ProgressBar: React.FC<{ progress: number }> = ({ progress }) => (
    <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
        <div
            className="h-full bg-blue-500 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
        />
    </div>
);

// --- Main Application ---

export default function OmniLearn() {
    // State: Permanent Data (Persisted in LocalStorage)
    const [courses, setCourses] = useState<Course[]>(() => {
        const saved = localStorage.getItem('omniLearn_courses');
        return saved ? JSON.parse(saved) : [];
    });

    // State: Session Data (Files are lost on reload due to browser security)
    const [activeFiles, setActiveFiles] = useState<Record<string, File>>({}); // Map: fileName -> FileObject
    const [currentCourseId, setCurrentCourseId] = useState<string | null>(null);
    const [activeVideo, setActiveVideo] = useState<ActiveVideo | null>(null);

    // UI State
    const [isSidebarOpen, setSidebarOpen] = useState<boolean>(true);
    const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
    const [tempLessonTitle, setTempLessonTitle] = useState<string>("");

    // Persist courses whenever they change
    useEffect(() => {
        localStorage.setItem('omniLearn_courses', JSON.stringify(courses));
    }, [courses]);

    // --- Handlers ---

    const handleFolderSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files || []);
        // Filter video files
        const videoFiles = files.filter(f => f.type.startsWith('video/') || f.name.match(/\.(mp4|mkv|webm|mov|avi)$/i));

        if (videoFiles.length === 0) {
            alert("Nenhum arquivo de vídeo encontrado nesta pasta.");
            return;
        }

        // Generate a temporary map of files for playback
        const fileMap: Record<string, File> = {};
        videoFiles.forEach(f => {
            // Create a unique key using relative path if available, or just name
            const key = f.webkitRelativePath || f.name;
            fileMap[key] = f;
        });
        setActiveFiles(prev => ({ ...prev, ...fileMap }));

        // Determine Course Name from folder structure
        const rootFolderName = videoFiles[0].webkitRelativePath.split('/')[0] || "Novo Curso";

        // Check if course already exists to update it, or create new
        const existingCourseIndex = courses.findIndex(c => c.title === rootFolderName);

        if (existingCourseIndex >= 0) {
            // Course exists: Just update file availability status internally (UI logic handles this)
            alert(`Arquivos carregados para o curso: ${rootFolderName}`);
            setCurrentCourseId(courses[existingCourseIndex].id);
        } else {
            // New Course: Auto-generate structure based on folders
            const newCourse = createCourseStructure(rootFolderName, videoFiles);
            setCourses(prev => [...prev, newCourse]);
            setCurrentCourseId(newCourse.id);
        }
    };

    const createCourseStructure = (courseTitle: string, files: File[]): Course => {
        const courseId = Date.now().toString();
        const modulesMap = new Map<string, Module>();

        // Default module
        modulesMap.set('Geral', { id: `mod_general_${courseId}`, title: 'Geral', lessons: [] });

        files.forEach(file => {
            const pathParts = file.webkitRelativePath.split('/');
            // pathParts: [CourseName, ModuleName?, FileName]

            let moduleName = 'Geral';

            if (pathParts.length > 2) {
                moduleName = pathParts[1]; // Subfolder is the module
            }

            if (!modulesMap.has(moduleName)) {
                modulesMap.set(moduleName, {
                    id: `mod_${moduleName}_${courseId}`,
                    title: moduleName,
                    lessons: []
                });
            }

            const lesson: Lesson = {
                id: `less_${file.name}_${Date.now()}_${Math.random()}`,
                fileKey: file.webkitRelativePath || file.name, // Key to link with activeFiles
                originalName: file.name,
                title: file.name.replace(/\.[^/.]+$/, ""), // Remove extension for display
                isCompleted: false,
                duration: 0
            };

            const module = modulesMap.get(moduleName);
            if (module) {
                module.lessons.push(lesson);
            }
        });

        // Sort lessons by name
        modulesMap.forEach(mod => {
            mod.lessons.sort((a, b) => a.originalName.localeCompare(b.originalName, undefined, { numeric: true }));
        });

        return {
            id: courseId,
            title: courseTitle,
            modules: Array.from(modulesMap.values()),
            createdAt: new Date().toISOString()
        };
    };

    const toggleLessonCompletion = (courseId: string, moduleId: string, lessonId: string, event: React.MouseEvent) => {
        event.stopPropagation();
        setCourses(prev => prev.map(course => {
            if (course.id !== courseId) return course;

            return {
                ...course,
                modules: course.modules.map(mod => {
                    if (mod.id !== moduleId) return mod;
                    return {
                        ...mod,
                        lessons: mod.lessons.map(lesson => {
                            if (lesson.id !== lessonId) return lesson;
                            return { ...lesson, isCompleted: !lesson.isCompleted };
                        })
                    };
                })
            };
        }));
    };

    const handlePlayVideo = (lesson: Lesson) => {
        const file = activeFiles[lesson.fileKey];
        if (file) {
            const url = URL.createObjectURL(file);
            setActiveVideo({ ...lesson, url });
        } else {
            alert("Arquivo de vídeo não encontrado na sessão atual. Por favor, selecione a pasta do curso novamente.");
        }
    };

    const renameLesson = (courseId: string, moduleId: string, lessonId: string, newTitle: string) => {
        setCourses(prev => prev.map(c => {
            if (c.id !== courseId) return c;
            return {
                ...c,
                modules: c.modules.map(m => {
                    if (m.id !== moduleId) return m;
                    return {
                        ...m,
                        lessons: m.lessons.map(l => {
                            if (l.id !== lessonId) return l;
                            return { ...l, title: newTitle };
                        })
                    };
                })
            };
        }));
        setEditingLessonId(null);
    };

    const deleteCourse = (courseId: string) => {
        if (window.confirm("Tem certeza que deseja remover este curso da lista? O progresso será perdido.")) {
            setCourses(prev => prev.filter(c => c.id !== courseId));
            if (currentCourseId === courseId) {
                setCurrentCourseId(null);
                setActiveVideo(null);
            }
        }
    };

    // --- Views ---

    const currentCourse = courses.find(c => c.id === currentCourseId);

    // Calculate Progress
    const getCourseStats = (course: Course) => {
        let total = 0;
        let completed = 0;
        course.modules.forEach(m => {
            total += m.lessons.length;
            completed += m.lessons.filter(l => l.isCompleted).length;
        });
        const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
        return { total, completed, percentage };
    };

    if (!currentCourse) {
        return (
            <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-blue-500/30">
                <div className="max-w-6xl mx-auto p-8">
                    <header className="flex justify-between items-center mb-12">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-blue-600 rounded-lg shadow-lg shadow-blue-900/40">
                                <Monitor className="text-white w-6 h-6" />
                            </div>
                            <h1 className="text-2xl font-bold tracking-tight text-white">OmniLearn <span className="text-blue-500">Local</span></h1>
                        </div>
                    </header>

                    <div className="grid md:grid-cols-2 gap-12 items-start">
                        <div>
                            <h2 className="text-4xl font-extrabold text-white leading-tight mb-6">
                                Sua central de estudos <br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
                                    direto do disco rígido.
                                </span>
                            </h2>
                            <p className="text-zinc-400 text-lg mb-8 leading-relaxed">
                                Aponte a pasta dos seus vídeos e nós criamos uma dashboard organizada para você.
                                Acompanhe seu progresso, renomeie aulas e organize módulos sem alterar os arquivos originais.
                            </p>

                            <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8 text-center hover:border-blue-500/50 transition-colors group cursor-pointer relative">
                                <input
                                    type="file"
                                    // Using spread with 'as any' to bypass Typescript errors for webkitdirectory
                                    {...({ webkitdirectory: "true", directory: "" } as any)}
                                    multiple
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                    onChange={handleFolderSelect}
                                />
                                <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                                    <FolderOpen className="w-8 h-8 text-blue-400" />
                                </div>
                                <h3 className="text-xl font-semibold text-white mb-2">Adicionar Novo Curso</h3>
                                <p className="text-zinc-500 text-sm">Clique para selecionar uma pasta com vídeos no seu computador</p>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-lg font-semibold text-zinc-200">Meus Cursos</h3>
                                <span className="text-xs text-zinc-500 bg-zinc-900 px-2 py-1 rounded border border-zinc-800">{courses.length} Cursos</span>
                            </div>

                            {courses.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-zinc-800 rounded-xl text-zinc-600">
                                    <Layout className="w-12 h-12 mb-4 opacity-20" />
                                    <p>Sua biblioteca está vazia.</p>
                                </div>
                            ) : (
                                <div className="grid gap-4">
                                    {courses.map(course => {
                                        const stats = getCourseStats(course);
                                        return (
                                            <Card key={course.id} className="group hover:border-zinc-700 transition-all">
                                                <div className="p-4 flex items-center justify-between">
                                                    <div
                                                        className="flex-1 cursor-pointer"
                                                        onClick={() => setCurrentCourseId(course.id)}
                                                    >
                                                        <h4 className="font-semibold text-zinc-200 group-hover:text-blue-400 transition-colors">{course.title}</h4>
                                                        <div className="flex items-center gap-4 mt-2 text-xs text-zinc-500">
                                                            <span className="flex items-center gap-1"><Video className="w-3 h-3" /> {stats.total} aulas</span>
                                                            <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3" /> {stats.completed} concluídas</span>
                                                        </div>
                                                        <div className="mt-3">
                                                            <ProgressBar progress={stats.percentage} />
                                                        </div>
                                                    </div>

                                                    <div className="ml-4 flex items-center gap-2">
                                                        <Button variant="ghost" className="!p-2 text-zinc-600 hover:text-red-400" onClick={() => deleteCourse(course.id)}>
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                        <Button
                                                            variant="secondary"
                                                            className="!p-2"
                                                            onClick={() => {
                                                                // Hint to user to re-select folder if needed, though clicking plays logic checks files
                                                                alert("Certifique-se de ter selecionado a pasta deste curso nesta sessão para habilitar o player.");
                                                                setCurrentCourseId(course.id);
                                                            }}
                                                        >
                                                            <Play className="w-4 h-4 fill-current" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </Card>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // --- Player View ---

    const courseStats = getCourseStats(currentCourse);

    return (
        <div className="flex h-screen bg-zinc-950 text-zinc-100 overflow-hidden font-sans">

            {/* Sidebar - Course Content */}
            <div
                className={`bg-zinc-900 border-r border-zinc-800 flex flex-col transition-all duration-300 ease-in-out ${isSidebarOpen ? 'w-80 md:w-96' : 'w-0 opacity-0 overflow-hidden'}`}
            >
                <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900 z-10">
                    <h2 className="font-bold text-zinc-100 truncate flex-1 pr-2" title={currentCourse.title}>
                        {currentCourse.title}
                    </h2>
                    <button onClick={() => setCurrentCourseId(null)} className="text-zinc-500 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-4 bg-zinc-900/50 border-b border-zinc-800">
                    <div className="flex justify-between text-xs text-zinc-400 mb-1">
                        <span>Progresso do Curso</span>
                        <span>{courseStats.percentage}%</span>
                    </div>
                    <ProgressBar progress={courseStats.percentage} />
                    <div className="mt-4">
                        <label className="flex items-center gap-2 w-full p-2 bg-blue-600/10 border border-blue-500/20 rounded-md text-xs text-blue-400 cursor-pointer hover:bg-blue-600/20 transition-colors">
                            <FolderOpen className="w-4 h-4" />
                            <span>Re-vincular pasta (se necessário)</span>
                            <input
                                type="file"
                                // Using spread with 'as any' to bypass Typescript errors for webkitdirectory
                                {...({ webkitdirectory: "true", directory: "" } as any)}
                                multiple
                                className="hidden"
                                onChange={handleFolderSelect}
                            />
                        </label>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                    {currentCourse.modules.map(module => (
                        <div key={module.id} className="mb-4">
                            <div className="flex items-center gap-2 px-2 py-1 text-zinc-500 font-medium text-xs uppercase tracking-wider mb-2">
                                <FolderOpen className="w-3 h-3" />
                                {module.title}
                            </div>
                            <div className="space-y-0.5">
                                {module.lessons.map(lesson => {
                                    const isActive = activeVideo?.id === lesson.id;
                                    const isFileAvailable = !!activeFiles[lesson.fileKey];

                                    return (
                                        <div
                                            key={lesson.id}
                                            className={`
                        group flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all
                        ${isActive ? 'bg-blue-600/10 border border-blue-600/20' : 'hover:bg-zinc-800 border border-transparent'}
                        ${!isFileAvailable ? 'opacity-50' : ''}
                      `}
                                            onClick={() => isFileAvailable && handlePlayVideo(lesson)}
                                        >
                                            <button
                                                className={`flex-shrink-0 transition-colors ${lesson.isCompleted ? 'text-green-500' : 'text-zinc-600 hover:text-zinc-400'}`}
                                                onClick={(e) => toggleLessonCompletion(currentCourse.id, module.id, lesson.id, e)}
                                            >
                                                {lesson.isCompleted ? <CheckCircle className="w-5 h-5 fill-current" /> : <Circle className="w-5 h-5" />}
                                            </button>

                                            <div className="flex-1 min-w-0">
                                                {editingLessonId === lesson.id ? (
                                                    <input
                                                        autoFocus
                                                        className="w-full bg-zinc-950 border border-blue-500 rounded px-1 py-0.5 text-sm text-white focus:outline-none"
                                                        value={tempLessonTitle}
                                                        onChange={(e) => setTempLessonTitle(e.target.value)}
                                                        onBlur={() => renameLesson(currentCourse.id, module.id, lesson.id, tempLessonTitle)}
                                                        onKeyDown={(e) => e.key === 'Enter' && renameLesson(currentCourse.id, module.id, lesson.id, tempLessonTitle)}
                                                        onClick={(e) => e.stopPropagation()}
                                                    />
                                                ) : (
                                                    <div className="flex justify-between items-start gap-2">
                                                        <p className={`text-sm font-medium truncate ${isActive ? 'text-blue-400' : 'text-zinc-300'}`}>
                                                            {lesson.title}
                                                        </p>
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[10px] text-zinc-500 bg-zinc-900/50 px-1.5 py-0.5 rounded border border-zinc-800/50">
                                                        {isFileAvailable ? 'Disponível' : 'Arquivo Ausente'}
                                                    </span>
                                                </div>
                                            </div>

                                            <button
                                                className="opacity-0 group-hover:opacity-100 p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700 rounded transition-all"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setEditingLessonId(lesson.id);
                                                    setTempLessonTitle(lesson.title);
                                                }}
                                            >
                                                <Edit3 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Content - Player */}
            <div className="flex-1 flex flex-col bg-zinc-950 relative">
                <div className="absolute top-4 left-4 z-20">
                    <button
                        onClick={() => setSidebarOpen(!isSidebarOpen)}
                        className="p-2 bg-zinc-900/80 backdrop-blur border border-zinc-700 text-zinc-300 rounded-md hover:text-white shadow-lg"
                    >
                        {isSidebarOpen ? <ChevronRight className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </button>
                </div>

                {activeVideo ? (
                    <div className="flex-1 flex flex-col">
                        <div className="flex-1 bg-black flex items-center justify-center relative shadow-inner shadow-zinc-900">
                            {/* Video Player Wrapper */}
                            <video
                                key={activeVideo.url} // Force reload on url change
                                controls
                                autoPlay
                                className="max-h-full w-full aspect-video outline-none"
                            >
                                <source src={activeVideo.url} type="video/mp4" />
                                Seu navegador não suporta a tag de vídeo.
                            </video>
                        </div>
                        <div className="p-6 border-t border-zinc-800 bg-zinc-950">
                            <div className="max-w-4xl mx-auto">
                                <h1 className="text-2xl font-bold text-white mb-2">{activeVideo.title}</h1>
                                <p className="text-zinc-500 text-sm flex items-center gap-2">
                                    <span className="bg-zinc-900 px-2 py-1 rounded text-zinc-400 border border-zinc-800 font-mono text-xs">{activeVideo.originalName}</span>
                                </p>

                                <div className="mt-6 flex gap-4 border-t border-zinc-900 pt-6">
                                    <div className="flex-1 bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
                                        <h3 className="text-sm font-semibold text-zinc-300 mb-2">Anotações da Aula</h3>
                                        <textarea
                                            className="w-full bg-transparent text-zinc-400 text-sm focus:outline-none resize-none h-24"
                                            placeholder="Escreva suas anotações aqui..."
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-zinc-600">
                        <div className="w-24 h-24 bg-zinc-900 rounded-full flex items-center justify-center mb-6 shadow-2xl shadow-black">
                            <Play className="w-10 h-10 ml-1 opacity-50" />
                        </div>
                        <p className="text-lg font-medium text-zinc-500">Selecione uma aula na barra lateral para começar</p>
                    </div>
                )}
            </div>

        </div>
    );
}