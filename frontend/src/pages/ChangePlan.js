import React, { useState, useEffect } from "react";
import axios from "axios";
import { useHistory } from "react-router";
import { NavLink } from "react-router-dom";
import PageLayout from "../layout/PageLayout";
import PlansCard from '../components/PlansCard';
import Error from '../components/Error';
import { toast } from 'react-toastify';
import { confirmAlert } from 'react-confirm-alert';
import CustomConfirmAlert from '../components/CustomConfirmAlert';
import useWatchLoginStatus from '../hooks/useWatchLoginStatus';
import TokenManager from '../utils/tokenManager';
import APP_CONFIG from '../config/appConfig';

const ChangePlan = () => {
    const history = useHistory();
    const [activePlanExist, setActivePlanExist] = useState(false);
    const [pageError, setPageError] = useState(false);
    const [changeSuccess, setChangeSuccess] = useState(false);
    const [currentPlan, setCurrentPlan] = useState(null);

    // Token management
    useWatchLoginStatus();
    const decodedToken = TokenManager.getDecodedToken();
    const accountUUID = decodedToken.account_uuid;


    useEffect(() => {
        let componentMounted = true;
        (async () => {
            try {
                const res = await axios.get(`${APP_CONFIG.baseUrl}/users/account/${accountUUID}`);
                console.log(res);
                const activeSubscription = res.data.results.active_subscription;
                if (componentMounted) {
                    // Check if user already has active subscription
                    // active means subscription status aka stripe_status can be:
                    // 'active', 'trialing', 'past_due', 'canceling'
                    if (activeSubscription) {
                        // User has existing active subscription
                        setCurrentPlan(() => activeSubscription.plan.plan_id);
                        setActivePlanExist(() => true);
                    } else {
                        setActivePlanExist(() => false);
                    }
                }
            } catch (error) {
                setPageError(() => true);
            }

        })();

        return (() => {
            componentMounted = false;
        });
    }, []);

    // Handlers
    const handleChangePlan = (plan) => {
        // Show confirmation modal
        confirmAlert({
            customUI: ({ onClose }) => {
                return <CustomConfirmAlert
                    message="Are you sure you want to change plan?"
                    onClose={onClose}
                    handler={(onClose) => executeChangePlan(onClose)}
                    heading="Confirm Change Plan?"
                />
            }
        });
        const executeChangePlan = async (onClose) => {
            // Don't allow switching of same plan
            if (plan === currentPlan) {
                toast.error("No changing to same plan!");
                return;
            } else {
                try {
                    await axios.put(`${APP_CONFIG.baseUrl}/stripe/subscriptions/${plan}`);
                    setChangeSuccess(() => true);
                    onClose();
                } catch (error) {
                    console.log(error);
                    let errCode = "Error!";
                    let errMsg = "Error!";
                    if (error.response !== undefined) {
                        errCode = error.response.status;
                        errMsg = error.response.data.message;
                    }
                    toast.error(
                        <>
                            Error Code: <b>{errCode}</b>
                            <br />
                            Message: <b>{errMsg}</b>
                        </>
                    );
                    onClose();
                }
            }
        };
    };

    return (
        <PageLayout title="Change Plan">
            <div className="c-Change-plan">
                {
                    pageError ?
                        <Error /> :
                        changeSuccess ?
                            <div className="c-Success">
                                <span>
                                    <svg viewBox="0 0 24 24">
                                        <path strokeWidth="2" fill="none" stroke="#ffffff" d="M 3,12 l 6,6 l 12, -12" />
                                    </svg>
                                </span>
                                <h1>Plan Change Successful!</h1>
                                <p>Your plan has been changed successfully!</p>
                                <p><NavLink to="/me">Go to account</NavLink></p>
                            </div> :
                            !activePlanExist ?
                                <Error
                                    heading="You do not have an active plan!"
                                    description="Sign up for a plan"
                                    displayLink="View Plans"
                                    link="/plans"
                                /> :
                                <>
                                    <div className="c-Change-plan__Top">
                                        <h1 className="c-Change-plan__Heading">Change Plan</h1>
                                        <p>Changing of subscription plan during free trial will not incur any charge.<br />
                                            After free trial, upgrading a subscription will incur a prorated charge immediately.<br />
                                            Downgrading subscription will result in credits to your account balance which will be applied in your next billing date.
                                        </p>
                                    </div>

                                    <div className="c-Change-plan__Cards">
                                        <PlansCard
                                            name="Standard"
                                            price="9.90"
                                            description="It's now or never, sign up now to waste money!"
                                            planID={1}
                                            mode="change"
                                            currentPlan={currentPlan}
                                            onClickHandler={handleChangePlan}
                                        />
                                        <PlansCard
                                            name="Premium"
                                            price="15.90"
                                            description="A slightly more expensive plan than standard plan."
                                            planID={2}
                                            mode="change"
                                            currentPlan={currentPlan}
                                            onClickHandler={handleChangePlan}
                                        />
                                    </div>
                                </>
                }
            </div>
        </PageLayout>
    )
}

export default ChangePlan;