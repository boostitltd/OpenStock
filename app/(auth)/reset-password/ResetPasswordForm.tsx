'use client';

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';

import FooterLink from '@/components/forms/FooterLink';
import InputField from '@/components/forms/InputField';
import PasswordRequirements from '@/components/forms/PasswordRequirements';
import OpenDevSocietyBranding from '@/components/OpenDevSocietyBranding';
import { Button } from '@/components/ui/button';
import { resetPasswordWithToken } from '@/lib/actions/auth.actions';
import { PASSWORD_VALIDATION } from '@/lib/constants';

type ResetPasswordFormData = {
    newPassword: string;
    confirmPassword: string;
};

const ResetPasswordForm = () => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get('token') ?? '';
    const error = searchParams.get('error');

    const {
        register,
        watch,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<ResetPasswordFormData>({
        defaultValues: {
            newPassword: '',
            confirmPassword: '',
        },
        mode: 'onBlur',
    });

    const newPassword = watch('newPassword');

    useEffect(() => {
        if (error === 'INVALID_TOKEN') {
            toast.error('הקישור לאיפוס לא תקין או שפג תוקפו.');
        }
    }, [error]);

    const onSubmit = async (data: ResetPasswordFormData) => {
        if (!token) {
            toast.error('הקישור לאיפוס לא תקין או שפג תוקפו.');
            return;
        }

        try {
            const result = await resetPasswordWithToken({
                token,
                newPassword: data.newPassword,
            });

            if (result.success) {
                toast.success('הסיסמה עודכנה. אפשר להתחבר.');
                router.push('/sign-in');
                return;
            }

            toast.error('איפוס הסיסמה נכשל', {
                description: result.error ?? 'לא הצלחנו לאפס את הסיסמה.',
            });
        } catch (error) {
            toast.error('איפוס הסיסמה נכשל', {
                description: error instanceof Error ? error.message : 'לא הצלחנו לאפס את הסיסמה.',
            });
        }
    };

    return (
        <>
            <h1 className="form-title">בחירת סיסמה חדשה</h1>
            <p className="text-sm text-gray-400 mb-6">
                Enter a new password for your account.
            </p>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <InputField
                    name="newPassword"
                    label="סיסמה חדשה"
                    placeholder="סיסמה חדשה"
                    type="password"
                    register={register}
                    error={errors.newPassword}
                    validation={PASSWORD_VALIDATION}
                />
                <PasswordRequirements password={newPassword ?? ''} />

                <InputField
                    name="confirmPassword"
                    label="אימות סיסמה"
                    placeholder="הקלידו שוב את הסיסמה החדשה"
                    type="password"
                    register={register}
                    error={errors.confirmPassword}
                    validation={{
                        required: 'צריך להקליד שוב את הסיסמה',
                        validate: (value: string) =>
                            value === newPassword || 'הסיסמאות לא זהות',
                    }}
                />

                <Button type="submit" disabled={isSubmitting} className="yellow-btn w-full mt-5">
                    {isSubmitting ? 'מאפסים' : 'לאפס סיסמה'}
                </Button>

                <FooterLink text="צריך קישור חדש?" linkText="לבקש עוד אחד" href="/forgot-password" />
                <OpenDevSocietyBranding outerClassName="mt-10 flex justify-center" />
            </form>
        </>
    );
};

export default ResetPasswordForm;
