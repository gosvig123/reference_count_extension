import { JavaScriptHandler } from '../../utils/languageHandlers';
import { testIsComponentUsage } from '../testUtils';

describe('ReactHandler (JavaScript Handler with React specifics)', () => {
    let handler: JavaScriptHandler;

    beforeEach(() => {
        handler = new JavaScriptHandler();
    });

    describe('isComponentUsage for React components', () => {
        it('should identify standard React components', () => {
            testIsComponentUsage(handler, '<MyComponent />', true);
            testIsComponentUsage(handler, '<MyComponent></MyComponent>', true);
            testIsComponentUsage(handler, '<App prop="value" />', true);
        });

        it('should identify nested components', () => {
            testIsComponentUsage(handler, '<Layout><Header /><Content /></Layout>', true);
            testIsComponentUsage(handler, '<Card><CardHeader /><CardBody><CardContent /></CardBody></Card>', true);
        });

        it('should identify components with props', () => {
            testIsComponentUsage(handler, '<Button onClick={() => handleClick()} disabled={isDisabled} />', true);
            testIsComponentUsage(handler, '<Input value={inputValue} onChange={handleChange} placeholder="Enter text" />', true);
        });

        it('should identify components in expressions', () => {
            testIsComponentUsage(handler, 'isLoggedIn && <UserProfile user={currentUser} />', true);
            testIsComponentUsage(handler, 'isLoading ? <Spinner /> : <Content data={data} />', true);
            testIsComponentUsage(handler, 'items.map(item => <ListItem key={item.id} {...item} />)', true);
        });

        it('should identify components as render props', () => {
            testIsComponentUsage(handler, '<Route render={() => <Dashboard />} />', true);
            testIsComponentUsage(handler, '<Modal content={<ModalContent />} />', true);
        });

        it('should identify dynamic components', () => {
            testIsComponentUsage(handler, 'const Component = components[type]; return <Component {...props} />;', true);
            testIsComponentUsage(handler, 'return createElement(MyComponent, props);', false); // This is a function call, not JSX
        });

        it('should identify components in fragment shorthand', () => {
            testIsComponentUsage(handler, '<><Header /><Content /></>', true);
            testIsComponentUsage(handler, '<Fragment><Title /><Subtitle /></Fragment>', true);
        });

        it('should not identify HTML elements as React components', () => {
            testIsComponentUsage(handler, '<div className="container">', false);
            testIsComponentUsage(handler, '<span style={{ color: "red" }}>Text</span>', false);
            testIsComponentUsage(handler, '<h1>Title</h1>', false);
            testIsComponentUsage(handler, '<button onClick={handleClick}>Click me</button>', false);
        });

        it('should handle edge cases correctly', () => {
            // Component name starting with lowercase (should be treated as HTML)
            testIsComponentUsage(handler, '<myComponent />', false);
            
            // Component with namespace
            testIsComponentUsage(handler, '<Namespace.Component />', true);
            
            // Component with numbers in name
            testIsComponentUsage(handler, '<Component123 />', true);
        });
    });
});
