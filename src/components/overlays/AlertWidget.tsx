import React from 'react';
import { motion } from 'motion/react';
import { Volume2 } from 'lucide-react';
import { InteractableElement } from './InteractableElement';

interface AlertWidgetProps {
    config: any;
    donation: any;
    isEditMode: boolean;
    onUpdate: (id: string, data: any) => void;
    className?: string;
    style?: React.CSSProperties;
    widthStr?: string;
    heightStr?: string;
    paddingStr?: string;
    boxBg?: any;
}

export function AlertWidget({ config, donation, isEditMode, onUpdate, className, style, widthStr, heightStr, paddingStr, boxBg }: AlertWidgetProps) {
    return (
        <InteractableElement
            id="container"
            config={config}
            isEditMode={isEditMode}
            onUpdate={onUpdate}
            className={`relative backdrop-blur-3xl border border-white/10 shadow-[0_40px_100px_rgba(0,0,0,0.8)] rounded-[2.5rem] text-center ${className}`}
            style={{ 
                ...boxBg,
                width: widthStr,
                height: heightStr,
                padding: paddingStr,
                ...style 
            }}
        >
            <div className="flex flex-col items-center justify-center">
                <InteractableElement
                    id="icon"
                    config={config}
                    isEditMode={isEditMode}
                    onUpdate={onUpdate}
                    className="w-20 h-20 rounded-[2rem] mb-6 shadow-[0_0_40px_var(--primary-glow)] flex items-center justify-center"
                    style={{ 
                        background: `linear-gradient(135deg, ${config.primaryColor}, transparent)`, 
                        '--primary-glow': config.primaryColor 
                    } as any}
                >
                    <Volume2 size={40} className="text-white" />
                </InteractableElement>

                <InteractableElement
                    id="text_top"
                    config={config}
                    isEditMode={isEditMode}
                    onUpdate={onUpdate}
                    className="text-center"
                >
                    <h2 className="text-chrome font-black italic uppercase tracking-tighter text-2xl mb-2">New Donation!</h2>
                    <div className="flex flex-col">
                        <span className="font-black text-4xl text-white tracking-tighter uppercase italic">
                           {donation.donorName} SENT 
                            <span style={{ color: config.primaryColor }}> {donation.originalCurrency || donation.currency || '₹'}{donation.originalAmount || donation.amount}</span>
                        </span>
                    </div>
                </InteractableElement>

                <InteractableElement
                    id="ticker"
                    config={config}
                    isEditMode={isEditMode}
                    onUpdate={onUpdate}
                    className="w-full overflow-hidden mt-4"
                >
                    <div className="bg-black/50 p-2 rounded-lg flex items-center gap-2">
                        <span className="text-[10px] font-black text-white uppercase">{config.stickyText || 'RECENT'}</span>
                        <motion.div 
                            className="whitespace-nowrap flex gap-4 text-xs font-bold text-white overflow-hidden"
                            animate={{ x: ["100%", "-100%"] }}
                            transition={{ ease: "linear", duration: config.tickerSpeed || 10, repeat: Infinity }}
                        >
                            {donation.recents?.map((d: any, i: number) => (
                                <span key={i}>{d.donorName}: {d.amount}</span>
                            ))}
                        </motion.div>
                    </div>
                </InteractableElement>

                <InteractableElement
                    id="message"
                    config={config}
                    isEditMode={isEditMode}
                    onUpdate={onUpdate}
                    className="w-full text-center"
                >
                    <div className="h-px w-full bg-white/10 my-4" />
                    <p className="text-zinc-400 font-bold italic text-sm leading-relaxed max-w-[80%] mx-auto">
                        "{donation.message}"
                    </p>
                </InteractableElement>
            </div>
        </InteractableElement>
    );
}
