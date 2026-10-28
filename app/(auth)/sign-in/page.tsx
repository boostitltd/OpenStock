'use client';

import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import InputField from '@/components/forms/InputField';
import FooterLink from '@/components/forms/FooterLink';
import { signInWithEmail } from "@/lib/actions/auth.actions";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import OpenDevSocietyBranding from "@/components/OpenDevSocietyBranding";
import SocialAuthButtons from "@/components/forms/SocialAuthButtons";
import React from "react";

const SignIn = () => {
    const router = useRouter()
    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<SignInFormData>({
        defaultValues: {
            email: '',
            password: '',
        },
        mode: 'onBlur',
    });

    const onSubmit = async (data: SignInFormData) => {
        try {
            const result = await signInWithEmail(data);
            if (result.success) {
                router.push('/dashboard');
                return;
            }
            toast.error('ההתחברות נכשלה', {
                description: result.error ?? 'המייל או הסיסמה שגויים.',
            });
        } catch (e) {
            console.error(e);
            toast.error('ההתחברות נכשלה', {
                description: e instanceof Error ? e.message : 'ההתחברות נכשלה.'
            })
        }
    }

    return (
        <>
            <h1 className="form-title mb-2">שמחים לראות אותך שוב</h1>
            <p className="mb-8 text-faint">התחברו לתיק, לרשימת המעקב ולהתראות.</p>

            <SocialAuthButtons />

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <InputField
                    name="email"
                    label="מייל"
                    placeholder="opendevsociety@cc.cc"
                    register={register}
                    error={errors.email}
                    validation={{
                        required: 'צריך למלא מייל',
                        pattern: {
                            value: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
                            message: 'כתובת המייל לא תקינה'
                        }
                    }}
                />

                <InputField
                    name="password"
                    label="סיסמה"
                    placeholder="הסיסמה שלך"
                    type="password"
                    register={register}
                    error={errors.password}
                    validation={{ required: 'צריך למלא סיסמה', minLength: 8 }}
                />

                <div className="flex justify-end">
                    <Link href="/forgot-password" className="footer-link text-sm">
                        שכחת סיסמה?
                    </Link>
                </div>

                <Button type="submit" disabled={isSubmitting} className="yellow-btn w-full mt-5">
                    {isSubmitting ? 'מתחברים' : 'התחברות'}
                </Button>

                <FooterLink text="אין לך חשבון?" linkText="להרשמה" href="/sign-up" />
                <OpenDevSocietyBranding outerClassName="mt-10 flex justify-center" />
            </form>
        </>
    );
};
export default SignIn;
