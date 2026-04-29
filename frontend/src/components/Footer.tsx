import { Link } from 'react-router-dom';
import { apps } from '../apps/index';
import { FaCog } from 'react-icons/fa';
import { CgMenuGridO } from 'react-icons/cg';

const Footer = () => {
    const footerApps = apps.filter(app => app.showInFooter && !app.isBottomItem && !app.isInternal);
    const settingsApp = {
        to: '/settings',
        label: 'Settings',
        icon: <FaCog className="h-4 w-4" />,
    };
    const applicationsApp = {
        to: '/applications',
        label: 'Applications',
        icon: <CgMenuGridO className="h-4 w-4" />,
    };

    return (
        <footer className="bg-black/50 backdrop-blur-lg text-gray-200 flex justify-between items-center bottom-0 w-full text-xs pe-4 border-t border-white/10">
            <span className='flex items-center px-3 space-x-1'>
                <div className="px-1 overflow-x-auto">
                    <div className='flex space-x-2'>
                        {footerApps.map((app) => {
                            const isSelected = window.location.pathname === app.to;
                            return (
                                <Link
                                    key={app.id}
                                    to={app.to}
                                    className={`border-b-2 pt-1 pb-0 px-2 transition-all flex flex-rows justify-center items-center space-x-1 hover:bg-white/5 whitespace-nowrap ${
                                        isSelected ? "border-orange-400" : "border-transparent"
                                    }`}
                                >
                                    {app.icon}
                                    <span>{app.label.toUpperCase()}</span>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            </span>
            <div className="flex space-x-6">
                <Link to={applicationsApp.to} className="flex items-center space-x-1 border-b-2 pt-1 pb-0 px-3 hover:border-orange-400 border-transparent transition-all">
                    {applicationsApp.icon}
                    <span>{applicationsApp.label.toUpperCase()}</span>
                </Link>
                <Link to={settingsApp.to} className="flex items-center space-x-1 border-b-2 pt-1 pb-0 px-3 mx-6 hover:border-orange-400 border-transparent transition-all">
                    {settingsApp.icon}
                    <span>{settingsApp.label.toUpperCase()}</span>
                </Link>
            </div>
        </footer>
    );
};

export default Footer;