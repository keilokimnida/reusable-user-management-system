import axios from 'axios';
import React, { useState, useEffect } from 'react';
import Spinner from 'react-bootstrap/Spinner';
import { useHistory } from 'react-router';
import * as BiIcons from 'react-icons/bi';
import { IconContext } from 'react-icons';
import { useStripe } from "@stripe/react-stripe-js";

import APP_CONFIG from '../config/appConfig';
import CheckoutSuccess from '../components/CheckoutSuccess';
import Error from '../components/Error';
import SetupPaymentMethod from '../components/SetupPaymentMethod';
import SelectPaymentMethod from '../components/SelectPaymentMethod';
import PageLayout from "../layout/PageLayout";
import useWatchLoginStatus from '../hooks/useWatchLoginStatus';
import TokenManager from '../utils/tokenManager';

const Checkout = ({ match }) => {

    const history = useHistory();

    // Token management
    useWatchLoginStatus();
    const decodedToken = TokenManager.getDecodedToken();
    const accountUUID = decodedToken.account_uuid;

    let displayPrice;
    let type = match.params.type;
    if (type) {
        if (type === "standard" || type === "premium") {
            type = type.charAt(0).toUpperCase() + type.slice(1);

            if (type === "standard") {
                displayPrice = "9.90";
            } else {
                displayPrice = "15.90";
            }
        }
        else {
            history.push("/page-not-found");
        }

    } else {
        history.push("/page-not-found");
    }

    // State Declarations
    const [rerender, setRerender] = useState(false);
    const [showSetupPaymentMethod, setShowSetupPaymentMethod] = useState(false);
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
    const [paymentMethods, setPaymentMethods] = useState([]);
    const [pageError, setPageError] = useState(false);
    const [isSubscriber, setIsSubscriber] = useState(false);
    const [freeTrial, setFreeTrial] = useState(false);

    // Stripe
    const [paymentError, setPaymentError] = useState(null);
    const [paymentProcessing, setPaymentProcessing] = useState(false);
    const [paymentDisabled, setPaymentDisabled] = useState(true);
    const [paymentSuccess, setPaymentSuccess] = useState(false);
    const [clientSecret, setClientSecret] = useState(null);
    const stripe = useStripe();

    useEffect(() => {
        let componentMounted = true;

        (async () => {
            try {
                const res = await axios.get(`${APP_CONFIG.baseUrl}/users/account/${accountUUID}`);
                console.log(res)
                const account = res.data.results;
                const activeSubscription = res.data.results.active_subscription;

                if (componentMounted) {
                    // Check if user has any payment methods type stored already
                    if (account.payment_accounts?.length > 0) {
                        setPaymentMethods(() => account.payment_accounts.map((paymentMethod) => ({
                            cardBrand: paymentMethod.stripe_card_type,
                            last4: paymentMethod.stripe_card_last_four_digit,
                            expDate: paymentMethod.stripe_card_exp_date,
                            stripePaymentMethodID: paymentMethod.stripe_payment_method_id
                        })));
                    } else {
                        setPaymentMethods(() => []);
                    }

                    // Check if user already has active subscription
                    // active means subscription status aka stripe_status can be:
                    // 'active', 'trialing', 'past_due', 'canceling'
                    if (activeSubscription) {
                        setIsSubscriber(() => true);
                    } else {
                        // Check if it's user's first time subscribing
                        if (!account.has_trialed) {
                            setFreeTrial(() => true);   // inform handleFormSubmit to start free trial instead of charging card
                            // Don't create subscription here
                            // Create it when user clicks on pay
                        } else {
                            // Create new subscription to be charged within 23hrs
                            // after 23 hours, if invoice has not been paid, subscription will be deleted from database
                            const subscription = await axios.post(`${APP_CONFIG.baseUrl}/stripe/subscriptions/${match.params.type}`, {});
                            console.log(subscription);

                            setClientSecret(() => subscription.data.clientSecret);
                        }
                    }
                }
            } catch (error) {
                console.log(error);
                const errCode = error.response?.status;
                if (errCode === 401) {
                    history.push("/logged-out");
                }
            }
        })();

        return (() => {
            componentMounted = false;
        });

    }, [rerender]);

    // Disable/enable form submit upon selecting/unselecting payment method
    useEffect(() => {
        let componentMounted = true;
        if (componentMounted) {
            if (selectedPaymentMethod !== null) {
                setPaymentDisabled(() => false);
            } else {
                setPaymentDisabled(() => true);
            }
        }
        return (() => {
            componentMounted = false;
        });
    }, [selectedPaymentMethod]);

    // Handlers

    // When user click on add credit/debit card
    const handleShowSetupPaymentMethod = () => {
        setShowSetupPaymentMethod((prevState) => !prevState);
        setSelectedPaymentMethod(() => null);
    };

    // When user select payment method
    const handleSelectPaymentMethod = (stripePaymentMethodID) => {
        if (stripePaymentMethodID === selectedPaymentMethod) {
            setSelectedPaymentMethod(() => null);
        } else {
            setSelectedPaymentMethod(() => stripePaymentMethodID);
        }
    };

    // When user click submit
    const handleFormSubmit = async (event) => {
        event.preventDefault();
        setPaymentProcessing(() => true);

        if (freeTrial) {
            try {
                await axios.post(`${APP_CONFIG.baseUrl}/stripe/subscriptions/${type}`, {
                    paymentMethodID: selectedPaymentMethod
                });

                setPaymentError(() => null);
                setPaymentProcessing(false);
                setPaymentSuccess(() => true);
            } catch (error) {
                console.log(error);
                // Error
                setPaymentError(() => `Error! Try again later!`);
                setPaymentProcessing(() => false);
            }
        } else {
            // If user has already trialed, 
            if (selectedPaymentMethod) {
                try {
                    const payload = await stripe.confirmCardPayment(clientSecret, {
                        payment_method: selectedPaymentMethod
                    });
                    if (payload.error) {
                        // Payment error
                        setPaymentError(() => `Payment failed! ${payload.error.message}`);
                        setPaymentProcessing(() => false);
                    } else {
                        // Payment success
                        setPaymentError(() => null);
                        setPaymentProcessing(false);
                        setPaymentSuccess(() => true);
                    }
                } catch (error) {
                    setPaymentError(() => `Payment failed! Something went wrong`);
                    setPaymentProcessing(() => false);
                }
            } else {
                setPaymentError(() => `Payment failed! No payment method`);
                setPaymentProcessing(() => false);
            }
        }

    };

    return (
        <>
            <SetupPaymentMethod show={showSetupPaymentMethod} handleClose={handleShowSetupPaymentMethod} setRerender={setRerender} />
            <PageLayout title="Checkout" TokenManager={TokenManager}>
                <div className="c-Checkout">
                    {
                        pageError ?
                            <Error />
                            :
                            isSubscriber ?
                                <Error
                                    heading="Error!"
                                    description="You already have an existing plan!"
                                    displayLink="Manage Account"
                                    link="/me"
                                />
                                :
                                paymentSuccess ?
                                    <CheckoutSuccess description={`You are now subscribed to ${type} plan!`} /> :
                                    <>
                                        <div className="c-Checkout__Heading">
                                            <h1>You are subscribing to <b>{type}</b> plan.</h1>
                                            <p>
                                                {freeTrial ?
                                                    <> Enjoy 7 Days of Premium Plan Free Trial. <br />Card will be automatically billed monthly.</> :
                                                    "Card will be automatically billed monthly"}
                                            </p>
                                        </div>


                                        {/* Form */}
                                        <form className="c-Checkout__Payment-details" onSubmit={handleFormSubmit}>
                                            <div className="c-Checkout__Card-info">
                                                <h2>Payment Mode</h2>
                                                {
                                                    paymentMethods.length > 0 ?
                                                        paymentMethods.map((paymentMethod, index) => (
                                                            <div className="c-Card-info__Payment-methods" key={index}>
                                                                <SelectPaymentMethod
                                                                    index={index}
                                                                    cardBrand={paymentMethod.cardBrand}
                                                                    last4={paymentMethod.last4}
                                                                    expDate={paymentMethod.expDate}
                                                                    stripePaymentMethodID={paymentMethod.stripePaymentMethodID}
                                                                    selectedPaymentMethod={selectedPaymentMethod}
                                                                    handleSelectPaymentMethod={handleSelectPaymentMethod} disabled={paymentProcessing} />
                                                            </div>
                                                        ))
                                                        :
                                                        <p>No payment methods found.</p>
                                                }

                                                <div className={paymentProcessing ? "l-Card-info__Add-card l-Card-info__Add-card--disabled" : "l-Card-info__Add-card"}>
                                                    <div className={paymentProcessing ? "c-Card-info__Add-card c-Card-info__Add-card--disabled" : "c-Card-info__Add-card"} onClick={handleShowSetupPaymentMethod}>
                                                        <p>
                                                            <IconContext.Provider value={{ color: "#172b4d", size: "21px" }}>
                                                                <BiIcons.BiCreditCard className="c-Add-card__Icon" />
                                                            </IconContext.Provider>
                                                            Add Credit / Debit Card
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Show any error that happens when processing the payment */}
                                                {paymentError && (
                                                    <div className="card-error" role="alert">
                                                        {paymentError}
                                                    </div>
                                                )}
                                            </div>
                                            <button
                                                disabled={paymentProcessing || paymentDisabled}
                                                className="c-Btn c-Btn--stripe-purple"
                                                type="submit"
                                            >
                                                {paymentProcessing ? (
                                                    <>
                                                        <Spinner animation="border" role="status" />
                                                    </>
                                                ) :
                                                    freeTrial ?
                                                        <>
                                                            Start 7 Day Free Trial
                                                        </>
                                                        :
                                                        <>
                                                            Pay S${displayPrice}
                                                        </>
                                                }
                                            </button>
                                            <button
                                                disabled={paymentProcessing}
                                                className="c-Btn c-Btn--stripe-primary"
                                                onClick={() => history.push("/plans")}
                                                type="button"
                                            >Back to Plans
                                            </button>
                                        </form>
                                    </>
                    }
                </div>
            </PageLayout>
        </>
    )
}

export default Checkout;