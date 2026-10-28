'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import InputField from '@/components/forms/InputField';
import FooterLink from '@/components/forms/FooterLink';
import OpenDevSocietyBranding from '@/components/OpenDevSocietyBranding';
import { requestPasswordResetEmail } from '@/lib/actions/auth.actions';

type ForgotPasswordFormData = {
    email: string;
};

const ForgotPasswordPage = () => {
    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<ForgotPasswordFormData>({
        defaultValues: {
            email: '',
        },
        mode: 'onBlur',
    });

    const onSubmit = async (data: ForgotPasswordFormData) => {
        try {
            const result = await requestPasswordResetEmail(data);

            if (result.success) {
                toast.success('אם יש חשבון עם המייל הזה, נשלח אליו קישור לאיפוס.');
                return;
            }

            toast.error('איפוס סיסמה לא זמין', {
                description: result.error ?? 'לא הצלחנו להתחיל איפוס סיסמה.',
            });
        } catch (error) {
            toast.error('איפוס סיסמה לא זמין', {
                description: error instanceof Error ? error.message : 'לא הצלחנו להתחיל איפוס סיסמה.',
            });
        }
    };

    return (
        <>
            <h1 className="form-title">שכחת את הסיסמה?</h1>
            <p className="text-sm text-gray-400 mb-6">
                כתבו את כתובת המייל, ונשלח אליה קישור לאיפוס הסיסמה.
            </p>

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
                            message: 'כתובת המייל לא תקינה',
                        },
                    }}
                />

                <Button type="submit" disabled={isSubmitting} className="yellow-btn w-full mt-5">
                    {isSubmitting ? 'שולחים קישור' : 'לשלוח קישור לאיפוס'}
                </Button>

                <FooterLink text="נזכרת?" linkText="להתחברות" href="/sign-in" />
                <OpenDevSocietyBranding outerClassName="mt-10 flex justify-center" />
            </form>
        </>
    );
};

export default ForgotPasswordPage;
