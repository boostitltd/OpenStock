'use client';

import { useForm } from "react-hook-form";
import { toast } from "sonner";
import InputField from "@/components/forms/InputField";
import PasswordRequirements from "@/components/forms/PasswordRequirements";
import { PASSWORD_VALIDATION } from "@/lib/constants";
import { changePassword } from "@/lib/actions/profile.actions";

type PasswordInput = { currentPassword: string; newPassword: string };

export default function PasswordForm() {
    const { register, handleSubmit, watch, reset, formState: { errors, isSubmitting } } = useForm<PasswordInput>({
        defaultValues: { currentPassword: '', newPassword: '' },
        mode: 'onBlur',
    });

    const onSubmit = async (values: PasswordInput) => {
        const result = await changePassword(values);
        if (!result.success) {
            toast.error('הסיסמה לא שונתה', { description: result.error });
            return;
        }
        toast.success('הסיסמה שונתה', { description: 'המכשירים האחרים נותקו.' });
        reset();
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 p-4">
            <InputField
                name="currentPassword"
                label="הסיסמה הנוכחית"
                placeholder="הסיסמה הנוכחית שלך"
                type="password"
                register={register}
                error={errors.currentPassword}
                validation={{ required: 'צריך למלא את הסיסמה הנוכחית' }}
            />
            <div className="flex flex-col gap-2">
                <InputField
                    name="newPassword"
                    label="סיסמה חדשה"
                    placeholder="לפחות 8 תווים"
                    type="password"
                    register={register}
                    error={errors.newPassword}
                    validation={PASSWORD_VALIDATION}
                />
                <PasswordRequirements password={watch('newPassword') ?? ''} />
            </div>
            <button type="submit" disabled={isSubmitting} className="btn btn-ghost self-start">
                {isSubmitting ? 'משנים' : 'לשנות סיסמה'}
            </button>
        </form>
    );
}
