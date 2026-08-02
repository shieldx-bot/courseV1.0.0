"use client";

import type { IDEFile, IDEProject } from "@/types/ide";

/**
 * Mock data for IDE projects
 */
export const mockPythonProject: IDEProject = {
  id: "python-project",
  name: "Python Project",
  language: "python",
  files: [
    {
      id: "main-py",
      name: "main.py",
      path: "/main.py",
      language: "python",
      content: `def greet(name: str) -> str:
    \"\"\"A simple greeting function\"\"\"
    return f\"Hello, {name}! Welcome to Python programming.\"

def calculate_sum(a: int, b: int) -> int:
    \"\"\"Calculate the sum of two numbers\"\"\"
    return a + b

if __name__ == \"__main__\":
    print(greet(\"World\"))
    result = calculate_sum(5, 7)
    print(f\"5 + 7 = {result}\")`,
    },
    {
      id: "utils-py",
      name: "utils.py",
      path: "/utils.py",
      language: "python",
      content: `def is_even(number: int) -> bool:
    \"\"\"Check if a number is even\"\"\"
    return number % 2 == 0

def factorial(n: int) -> int:
    \"\"\"Calculate factorial of a number\"\"\"
    if n == 0:
        return 1
    return n * factorial(n - 1)`,
    },
    {
      id: "data-py",
      name: "data.py",
      path: "/data.py",
      language: "python",
      content: `# Sample data structures
students = [
    {\"id\": 1, \"name\": \"Alice\", \"grade\": \"A\"},
    {\"id\": 2, \"name\": \"Bob\", \"grade\": \"B\"},
    {\"id\": 3, \"name\": \"Charlie\", \"grade\": \"C\"},
]

def get_student_by_id(student_id: int):
    \"\"\"Get student by ID\"\"\"
    for student in students:
        if student[\"id\"] == student_id:
            return student
    return None`,
    },
  ],
};

export const mockJavaScriptProject: IDEProject = {
  id: "javascript-project",
  name: "JavaScript Project",
  language: "javascript",
  files: [
    {
      id: "index-js",
      name: "index.js",
      path: "/index.js",
      language: "javascript",
      content: `// Main JavaScript file
function greet(name) {
    return \`Hello, \${name}! Welcome to JavaScript programming.\`;
}

function calculateSum(a, b) {
    return a + b;
}

console.log(greet(\"World\"));
const result = calculateSum(5, 7);
console.log(\`5 + 7 = \${result}\`);`,
    },
    {
      id: "utils-js",
      name: "utils.js",
      path: "/utils.js",
      language: "javascript",
      content: `// Utility functions
function isEven(number) {
    return number % 2 === 0;
}

function factorial(n) {
    if (n === 0) {
        return 1;
    }
    return n * factorial(n - 1);
}

module.exports = {
    isEven,
    factorial
};`,
    },
    {
      id: "data-js",
      name: "data.js",
      path: "/data.js",
      language: "javascript",
      content: `// Sample data
const students = [
    {id: 1, name: \"Alice\", grade: \"A\"},
    {id: 2, name: \"Bob\", grade: \"B\"},
    {id: 3, name: \"Charlie\", grade: \"C\"},
];

function getStudentById(studentId) {
    return students.find(student => student.id === studentId);
}

module.exports = {
    students,
    getStudentById
};`,
    },
  ],
};

/**
 * Build a file tree structure from flat file list
 */
export function buildFileTree(files: IDEFile[]): IDEFile[] {
  // Simple implementation - just return the files as-is
  // In a real implementation, this would build a hierarchical tree structure
  return [...files];
}