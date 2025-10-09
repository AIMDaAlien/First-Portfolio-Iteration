/*!
 * Contact Form Handler with EmailJS Integration
 * Service: Gmail (service_72xb30c)
 * Version: 1.0.0
 */

(function() {
    'use strict';
    
    const CONFIG = {
        publicKey: 'Bdw3MbjffAz7Cy9cL',
        serviceId: 'service_72xb30c',
        templateId: 'template_z9ozaj7'
    };
    
    emailjs.init(CONFIG.publicKey);
    
    let formElement;
    let submitButton;
    let buttonText;
    let buttonLoading;
    let statusDiv;
    
    function initializeContactForm() {
        formElement = document.getElementById('contact-form');
        submitButton = document.getElementById('submit-btn');
        buttonText = submitButton?.querySelector('.btn-text');
        buttonLoading = submitButton?.querySelector('.btn-loading');
        statusDiv = document.getElementById('form-status');
        
        if (!formElement || !submitButton || !statusDiv) {
            console.error('[Contact Form] Required DOM elements not found');
            return;
        }
        
        formElement.addEventListener('submit', handleFormSubmit);
        addInputValidation();
        
        console.log('[Contact Form] Initialized successfully');
    }
    
    function handleFormSubmit(event) {
        event.preventDefault();
        
        if (!validateForm()) {
            showStatus('Please fill in all required fields correctly.', 'error');
            return;
        }
        
        setLoadingState(true);
        
        emailjs.sendForm(
            CONFIG.serviceId,
            CONFIG.templateId,
            formElement
        )
        .then(handleSubmitSuccess, handleSubmitError)
        .finally(() => setLoadingState(false));
    }
    
    function handleSubmitSuccess(response) {
        console.log('[EmailJS] Success:', response.status, response.text);
        
        showStatus(
            'Message sent successfully! I\'ll get back to you within 24-48 hours.',
            'success'
        );
        
        formElement.reset();
        
        if (typeof gtag !== 'undefined') {
            gtag('event', 'form_submission', {
                'event_category': 'Contact',
                'event_label': 'EmailJS'
            });
        }
    }
    
    function handleSubmitError(error) {
        console.error('[EmailJS] Failed:', error);
        
        showStatus(
            'Failed to send message. Please email directly at: aim [at] outlook [dot] com',
            'error'
        );
    }
    
    function validateForm() {
        const name = formElement.querySelector('#from_name')?.value.trim();
        const email = formElement.querySelector('#reply_to')?.value.trim();
        const message = formElement.querySelector('#message')?.value.trim();
        
        if (!name || !email || !message) {
            return false;
        }
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            showStatus('Please enter a valid email address.', 'error');
            return false;
        }
        
        if (message.length < 10) {
            showStatus('Message must be at least 10 characters long.', 'error');
            return false;
        }
        
        return true;
    }
    
    function addInputValidation() {
        const emailInput = formElement.querySelector('#reply_to');
        
        if (emailInput) {
            emailInput.addEventListener('blur', function() {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (this.value && !emailRegex.test(this.value)) {
                    this.classList.add('invalid');
                } else {
                    this.classList.remove('invalid');
                }
            });
        }
    }
    
    function setLoadingState(isLoading) {
        if (isLoading) {
            submitButton.disabled = true;
            buttonText.style.display = 'none';
            buttonLoading.style.display = 'inline';
            statusDiv.style.display = 'none';
        } else {
            submitButton.disabled = false;
            buttonText.style.display = 'inline';
            buttonLoading.style.display = 'none';
        }
    }
    
    function showStatus(message, type) {
        statusDiv.textContent = message;
        statusDiv.className = 'form-status ' + type;
        statusDiv.style.display = 'block';
        
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 6000);
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeContactForm);
    } else {
        initializeContactForm();
    }
    
})();
